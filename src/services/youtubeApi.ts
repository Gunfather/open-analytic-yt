import {
  AutoNicheTrend,
  Channel,
  CompetitorChannel,
  CompetitorVideo,
  NicheVideoItem,
  TrendingYouTubeVideo,
  VideoItem,
} from '../types/youtube';

interface YTChannelResponse {
  items?: Array<{
    id: string;
    snippet: {
      title: string;
      customUrl?: string;
      thumbnails?: {
        default?: { url: string };
        medium?: { url: string };
      };
    };
    statistics: {
      viewCount?: string;
      subscriberCount?: string;
      videoCount?: string;
    };
    contentDetails?: {
      relatedPlaylists?: {
        uploads?: string;
      };
    };
  }>;
}

interface YTPlaylistItemsResponse {
  items?: Array<{
    contentDetails: {
      videoId: string;
      videoPublishedAt: string;
    };
  }>;
}

interface YTVideosResponse {
  items?: Array<{
    id: string;
    snippet: {
      title: string;
      publishedAt: string;
      thumbnails?: {
        medium?: { url: string };
      };
    };
    statistics: {
      viewCount?: string;
      likeCount?: string;
      commentCount?: string;
    };
    contentDetails: {
      duration: string;
    };
  }>;
}

function parseIsoDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 60;
  const h = parseInt(match[1] || '0', 10);
  const m = parseInt(match[2] || '0', 10);
  const s = parseInt(match[3] || '0', 10);
  return h * 3600 + m * 60 + s;
}

export async function fetchYouTubeChannelData(
  apiKey: string,
  channelIdOrHandle: string
): Promise<{
  youtubeChannelId: string;
  name: string;
  handle: string;
  avatarUrl: string;
  subscribersTotal: number;
  viewsTotal: number;
  videosTotal: number;
  uploadsPlaylistId?: string;
}> {
  const trimmed = channelIdOrHandle.trim();
  const isChannelId = /^UC[\w-]{20,}$/.test(trimmed);
  const param = isChannelId
    ? `id=${encodeURIComponent(trimmed)}`
    : `forHandle=${encodeURIComponent(trimmed.startsWith('@') ? trimmed : `@${trimmed}`)}`;

  const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&${param}&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`YouTube API erro (${res.status}): ${errText.slice(0, 140)}`);
  }

  const data = (await res.json()) as YTChannelResponse;
  const item = data.items?.[0];
  if (!item) {
    throw new Error(`Canal "${trimmed}" não encontrado na YouTube Data API.`);
  }

  return {
    youtubeChannelId: item.id,
    name: item.snippet.title,
    handle: item.snippet.customUrl || trimmed,
    avatarUrl:
      item.snippet.thumbnails?.medium?.url ||
      item.snippet.thumbnails?.default?.url ||
      `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(item.snippet.title)}`,
    subscribersTotal: Number(item.statistics.subscriberCount || 0),
    viewsTotal: Number(item.statistics.viewCount || 0),
    videosTotal: Number(item.statistics.videoCount || 0),
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads,
  };
}

export async function fetchRecentVideosForChannel(
  apiKey: string,
  channel: Channel,
  uploadsPlaylistId: string,
  maxResults = 12
): Promise<VideoItem[]> {
  const plUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${encodeURIComponent(
    uploadsPlaylistId
  )}&maxResults=${maxResults}&key=${encodeURIComponent(apiKey)}`;

  const plRes = await fetch(plUrl);
  if (!plRes.ok) return [];
  const plData = (await plRes.json()) as YTPlaylistItemsResponse;
  const videoIds = (plData.items || []).map((i) => i.contentDetails.videoId).filter(Boolean);
  if (videoIds.length === 0) return [];

  const vUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(
    ','
  )}&key=${encodeURIComponent(apiKey)}`;
  const vRes = await fetch(vUrl);
  if (!vRes.ok) return [];
  const vData = (await vRes.json()) as YTVideosResponse;

  return (vData.items || []).map((v) => {
    const views = Number(v.statistics.viewCount || 0);
    const likes = Number(v.statistics.likeCount || 0);
    const comments = Number(v.statistics.commentCount || 0);
    const durationSec = parseIsoDuration(v.contentDetails.duration);
    const isShort = durationSec <= 65;

    return {
      id: v.id,
      channelId: channel.id,
      title: v.snippet.title,
      publishedAt: v.snippet.publishedAt.slice(0, 10),
      thumbnailUrl: v.snippet.thumbnails?.medium?.url || '',
      durationSec,
      isShort,
      views,
      engagedViews: Math.round(views * (channel.engagedRate / 100)),
      watchTimeHours: Number(((views * (isShort ? 0.65 : 3.5)) / 60).toFixed(1)),
      likes,
      comments,
      shares: Math.round(likes * 0.08),
      revenue: Number(((views / 1000) * channel.rpm).toFixed(2)),
      hookRate: channel.hookRate,
      ctr: 6.4,
    };
  });
}

export async function fetchPublicChannelWithoutKey(
  target: string,
  baseRpm = 2.5,
  engagedRate = 52
): Promise<{
  youtubeChannelId: string;
  name: string;
  handle: string;
  avatarUrl: string;
  subscribersTotal: number;
  videos: VideoItem[];
  channelIdPlaceholder: string;
}> {
  const res = await fetch(`/api/yt-public?target=${encodeURIComponent(target.trim())}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Falha ao buscar canal público (${res.status})`);
  }
  const data = (await res.json()) as {
    youtubeChannelId: string;
    name: string;
    handle: string;
    avatarUrl: string;
    subscribersTotal: number;
    videos: Array<{
      id: string;
      title: string;
      publishedAt: string;
      thumbnailUrl: string;
      views: number;
      likes: number;
    }>;
  };

  const videos: VideoItem[] = (data.videos || []).map((v) => {
    const isShort = v.title.toLowerCase().includes('#shorts');
    return {
      id: v.id,
      channelId: '',
      title: v.title,
      publishedAt: v.publishedAt,
      thumbnailUrl: v.thumbnailUrl,
      durationSec: isShort ? 45 : 420,
      isShort,
      views: v.views,
      engagedViews: Math.round(v.views * (engagedRate / 100)),
      watchTimeHours: Number(((v.views * (isShort ? 0.65 : 3.5)) / 60).toFixed(1)),
      likes: v.likes,
      comments: Math.round(v.likes * 0.08),
      shares: Math.round(v.likes * 0.05),
      revenue: Number(((v.views / 1000) * baseRpm).toFixed(2)),
      hookRate: 60,
      ctr: 6.2,
    };
  });

  return {
    youtubeChannelId: data.youtubeChannelId,
    name: data.name,
    handle: data.handle,
    avatarUrl: data.avatarUrl,
    subscribersTotal: data.subscribersTotal,
    videos,
    channelIdPlaceholder: data.youtubeChannelId,
  };
}

export function parseYouTubeStudioCsv(
  csvText: string,
  channel: Channel
): Array<{
  date: string;
  channelId: string;
  views: number;
  engagedViews: number;
  watchTimeHours: number;
  subscribersGained: number;
  likes: number;
  comments: number;
  shares: number;
  revenue: number;
}> {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.replace(/"/g, '').trim().toLowerCase());
  const findCol = (keywords: string[]) =>
    headers.findIndex((h) => keywords.some((k) => h.includes(k)));

  const dateIdx = findCol(['date', 'data']);
  const viewsIdx = findCol(['views', 'visualizações', 'visualizacoes']);
  const watchIdx = findCol(['watch time', 'tempo de exibição', 'tempo de exibicao']);
  const subsIdx = findCol(['subscribers', 'inscritos']);
  const revIdx = findCol(['revenue', 'receita']);
  const likesIdx = findCol(['likes', 'marcações', 'gostei']);

  if (dateIdx === -1 || viewsIdx === -1) return [];

  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.replace(/"/g, '').trim());
    const rawDate = cols[dateIdx];
    if (!/^\d{4}-\d{2}-\d{2}/.test(rawDate)) continue;
    const date = rawDate.slice(0, 10);
    const views = parseInt(cols[viewsIdx] || '0', 10) || 0;
    const watchTimeHours =
      watchIdx >= 0 ? parseFloat(cols[watchIdx] || '0') || 0 : Number(((views * 2.2) / 60).toFixed(1));
    const subscribersGained = subsIdx >= 0 ? parseInt(cols[subsIdx] || '0', 10) || 0 : 0;
    const revenue =
      revIdx >= 0
        ? parseFloat(cols[revIdx] || '0') || 0
        : Number(((views / 1000) * channel.rpm).toFixed(2));
    const likes = likesIdx >= 0 ? parseInt(cols[likesIdx] || '0', 10) || 0 : Math.round(views * 0.035);

    results.push({
      date,
      channelId: channel.id,
      views,
      engagedViews: Math.round(views * (channel.engagedRate / 100)),
      watchTimeHours,
      subscribersGained,
      likes,
      comments: Math.round(likes * 0.1),
      shares: Math.round(likes * 0.06),
      revenue,
    });
  }

  return results;
}

const NICHE_CACHE_KEY = 'open_analytic_niche_cache_v2';
const NICHE_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface NicheCacheEntry {
  savedAt: number;
  source: 'api' | 'public';
  items: NicheVideoItem[];
}

function readNicheCache(cacheId: string): NicheCacheEntry | null {
  try {
    const raw = localStorage.getItem(NICHE_CACHE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, NicheCacheEntry>;
    const entry = map[cacheId];
    if (!entry) return null;
    if (Date.now() - entry.savedAt > NICHE_CACHE_TTL_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

function writeNicheCache(cacheId: string, entry: NicheCacheEntry) {
  try {
    const raw = localStorage.getItem(NICHE_CACHE_KEY);
    const map: Record<string, NicheCacheEntry> = raw ? JSON.parse(raw) : {};
    const keys = Object.keys(map);
    if (keys.length > 25) {
      const oldest = keys.sort((a, b) => (map[a]?.savedAt || 0) - (map[b]?.savedAt || 0))[0];
      if (oldest) delete map[oldest];
    }
    map[cacheId] = entry;
    localStorage.setItem(NICHE_CACHE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

export async function searchNicheVideos(params: {
  query: string;
  regionCode: string;
  relevanceLanguage: string;
  publishedAfterDays: number; // 0 = any time
  apiKey?: string;
  forceRefresh?: boolean;
}): Promise<{ items: NicheVideoItem[]; source: 'api' | 'public'; fromCache: boolean }> {
  const cleanQuery = params.query.trim();
  if (!cleanQuery) return { items: [], source: 'public', fromCache: false };

  const modeKey = params.apiKey ? 'api' : 'pub';
  const cacheId = `${cleanQuery.toLowerCase()}::${params.regionCode}::${params.publishedAfterDays}::${modeKey}`;

  if (!params.forceRefresh) {
    const cached = readNicheCache(cacheId);
    if (cached && cached.items.length > 0) {
      return { items: cached.items, source: cached.source, fromCache: true };
    }
  }

  // 1) Official YouTube Data API v3 when key is configured
  if (params.apiKey) {
    try {
      const publishedAfterParam =
        params.publishedAfterDays > 0
          ? `&publishedAfter=${encodeURIComponent(
              new Date(Date.now() - params.publishedAfterDays * 86400000).toISOString()
            )}`
          : '';
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=24&order=viewCount&regionCode=${encodeURIComponent(
        params.regionCode
      )}&relevanceLanguage=${encodeURIComponent(
        params.relevanceLanguage
      )}${publishedAfterParam}&q=${encodeURIComponent(cleanQuery)}&key=${encodeURIComponent(
        params.apiKey
      )}`;

      const sRes = await fetch(searchUrl);
      if (sRes.ok) {
        const sData = (await sRes.json()) as {
          items?: Array<{ id?: { videoId?: string }; snippet?: { channelId?: string } }>;
        };
        const videoIds = Array.from(
          new Set((sData.items || []).map((i) => i.id?.videoId || '').filter(Boolean))
        );

        if (videoIds.length > 0) {
          const vUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(
            ','
          )}&key=${encodeURIComponent(params.apiKey)}`;
          const vRes = await fetch(vUrl);
          const vData = vRes.ok
            ? ((await vRes.json()) as {
                items?: Array<{
                  id: string;
                  snippet: {
                    title: string;
                    channelId: string;
                    channelTitle: string;
                    publishedAt: string;
                    thumbnails?: { medium?: { url: string }; high?: { url: string } };
                  };
                  statistics: {
                    viewCount?: string;
                    likeCount?: string;
                    commentCount?: string;
                  };
                  contentDetails: { duration: string };
                }>;
              })
            : { items: [] };

          const uniqueChannelIds = Array.from(
            new Set((vData.items || []).map((v) => v.snippet.channelId).filter(Boolean))
          );

          const chStatsMap = new Map<
            string,
            { subs: number; avgViews: number; handle?: string }
          >();

          if (uniqueChannelIds.length > 0) {
            const cUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${uniqueChannelIds.join(
              ','
            )}&key=${encodeURIComponent(params.apiKey)}`;
            const cRes = await fetch(cUrl);
            if (cRes.ok) {
              const cData = (await cRes.json()) as YTChannelResponse;
              for (const c of cData.items || []) {
                const subs = Number(c.statistics.subscriberCount || 0);
                const totalViews = Number(c.statistics.viewCount || 0);
                const totalVids = Math.max(1, Number(c.statistics.videoCount || 1));
                const avgViews =
                  totalViews > 0 ? Math.round(totalViews / totalVids) : Math.max(subs, 250);
                chStatsMap.set(c.id, {
                  subs,
                  avgViews,
                  handle: c.snippet.customUrl,
                });
              }
            }
          }

          const nowMs = Date.now();
          const items: NicheVideoItem[] = (vData.items || []).map((v) => {
            const views = Number(v.statistics.viewCount || 0);
            const likes = Number(v.statistics.likeCount || 0);
            const comments = Number(v.statistics.commentCount || 0);
            const durationSec = parseIsoDuration(v.contentDetails.duration);
            const isShort = durationSec <= 65;
            const pubIso = v.snippet.publishedAt || new Date().toISOString();
            const daysAgo = Math.max(
              1,
              Math.round((nowMs - new Date(pubIso).getTime()) / 86400000)
            );
            const chInfo = chStatsMap.get(v.snippet.channelId);
            const channelSubs = chInfo?.subs ?? 0;
            const baseline = Math.max(chInfo?.avgViews || channelSubs || 500, 150);
            const outlierScore = Number((views / baseline).toFixed(2));
            const engagementRate =
              views > 0 ? Number((((likes + comments) / views) * 100).toFixed(2)) : 0;

            return {
              id: v.id,
              title: v.snippet.title,
              channelId: v.snippet.channelId,
              channelTitle: v.snippet.channelTitle,
              channelHandle: chInfo?.handle,
              channelSubs,
              publishedAt: pubIso.slice(0, 10),
              daysAgo,
              thumbnailUrl:
                v.snippet.thumbnails?.high?.url || v.snippet.thumbnails?.medium?.url || '',
              durationSec,
              isShort,
              views,
              likes,
              comments,
              viewsPerDay: Math.round(views / daysAgo),
              outlierScore,
              engagementRate,
            };
          });

          writeNicheCache(cacheId, { savedAt: Date.now(), source: 'api', items });
          return { items, source: 'api', fromCache: false };
        }
      }
    } catch {
      // Fallback to public search below if API quota exceeded or fails
    }
  }

  // 2) Public zero-quota fallback via local Vite proxy (/api/yt-search)
  const pubRes = await fetch(
    `/api/yt-search?q=${encodeURIComponent(cleanQuery)}&gl=${encodeURIComponent(
      params.regionCode
    )}&hl=${encodeURIComponent(params.relevanceLanguage)}`
  );
  if (!pubRes.ok) {
    const errBody = await pubRes.json().catch(() => ({}));
    throw new Error(errBody.error || `Falha na busca pública (${pubRes.status})`);
  }

  const pubData = (await pubRes.json()) as {
    items?: Array<{
      id: string;
      title: string;
      channelId: string;
      channelTitle: string;
      channelHandle?: string;
      publishedAt: string;
      daysAgo: number;
      thumbnailUrl: string;
      durationSec: number;
      isShort: boolean;
      views: number;
    }>;
  };

  const rawItems = (pubData.items || []).filter((v) =>
    params.publishedAfterDays > 0 ? v.daysAgo <= params.publishedAfterDays : true
  );

  // Use sample median views as baseline when channel subscriber stats are unavailable publicly
  const sortedViews = [...rawItems.map((i) => i.views)].sort((a, b) => a - b);
  const medianSampleViews = Math.max(
    sortedViews[Math.floor(sortedViews.length / 2)] || 2500,
    300
  );

  const items: NicheVideoItem[] = rawItems.map((v) => {
    const likes = Math.round(v.views * 0.038);
    const comments = Math.round(v.views * 0.004);
    const daysAgo = Math.max(1, v.daysAgo || 7);
    const outlierScore = Number((v.views / medianSampleViews).toFixed(2));
    const engagementRate =
      v.views > 0 ? Number((((likes + comments) / v.views) * 100).toFixed(2)) : 0;

    return {
      id: v.id,
      title: v.title,
      channelId: v.channelId,
      channelTitle: v.channelTitle,
      channelHandle: v.channelHandle,
      channelSubs: 0,
      publishedAt: v.publishedAt,
      daysAgo,
      thumbnailUrl: v.thumbnailUrl,
      durationSec: v.durationSec,
      isShort: v.isShort,
      views: v.views,
      likes,
      comments,
      viewsPerDay: Math.round(v.views / daysAgo),
      outlierScore,
      engagementRate,
    };
  });

  writeNicheCache(cacheId, { savedAt: Date.now(), source: 'public', items });
  return { items, source: 'public', fromCache: false };
}

export async function fetchCompetitorChannelSnapshot(params: {
  apiKey?: string;
  target: string;
  nicheTag: string;
  languageId: string;
  existingId?: string;
}): Promise<CompetitorChannel> {
  const id = params.existingId || `comp-${Date.now()}`;
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  if (params.apiKey) {
    const live = await fetchYouTubeChannelData(params.apiKey, params.target);
    let rawVideos: VideoItem[] = [];
    if (live.uploadsPlaylistId) {
      const dummyCh: Channel = {
        id,
        handle: live.handle,
        name: live.name,
        languageId: params.languageId,
        avatarUrl: live.avatarUrl,
        color: '#f97316',
        isActive: true,
        subscribersTotal: live.subscribersTotal,
        viewsTotal: live.viewsTotal,
        videosTotal: live.videosTotal,
        rpm: 2.5,
        cpm: 4.5,
        hookRate: 60,
        engagedRate: 52,
        lastSyncedAt: nowIso,
      };
      rawVideos = await fetchRecentVideosForChannel(
        params.apiKey,
        dummyCh,
        live.uploadsPlaylistId,
        20
      );
    }

    const avgViewsRecent =
      rawVideos.length > 0
        ? Math.round(rawVideos.reduce((s, v) => s + v.views, 0) / rawVideos.length)
        : live.videosTotal > 0
        ? Math.round(live.viewsTotal / live.videosTotal)
        : 0;
    const baseline = Math.max(avgViewsRecent, 100);

    const videos: CompetitorVideo[] = rawVideos.map((v) => {
      const daysAgo = Math.max(
        1,
        Math.round((nowMs - new Date(v.publishedAt).getTime()) / 86400000)
      );
      return {
        id: v.id,
        title: v.title,
        publishedAt: v.publishedAt,
        thumbnailUrl: v.thumbnailUrl,
        durationSec: v.durationSec,
        isShort: v.isShort,
        views: v.views,
        likes: v.likes,
        comments: v.comments,
        outlierScore: Number((v.views / baseline).toFixed(2)),
        viewsPerDay: Math.round(v.views / daysAgo),
      };
    });

    return {
      id,
      youtubeChannelId: live.youtubeChannelId,
      handle: live.handle.startsWith('@') ? live.handle : `@${live.handle}`,
      name: live.name,
      nicheTag: params.nicheTag.trim() || 'Geral',
      languageId: params.languageId,
      avatarUrl: live.avatarUrl,
      subscribersTotal: live.subscribersTotal,
      viewsTotal: live.viewsTotal,
      videosTotal: live.videosTotal,
      avgViewsRecent,
      videos,
      lastSyncedAt: nowIso,
    };
  }

  const pub = await fetchPublicChannelWithoutKey(params.target);
  const avgViewsRecent =
    pub.videos.length > 0
      ? Math.round(pub.videos.reduce((s, v) => s + v.views, 0) / pub.videos.length)
      : 0;
  const baseline = Math.max(avgViewsRecent, 100);

  const videos: CompetitorVideo[] = pub.videos.map((v) => {
    const daysAgo = Math.max(
      1,
      Math.round((nowMs - new Date(v.publishedAt).getTime()) / 86400000)
    );
    return {
      id: v.id,
      title: v.title,
      publishedAt: v.publishedAt,
      thumbnailUrl: v.thumbnailUrl,
      durationSec: v.durationSec,
      isShort: v.isShort,
      views: v.views,
      likes: v.likes,
      comments: v.comments,
      outlierScore: Number((v.views / baseline).toFixed(2)),
      viewsPerDay: Math.round(v.views / daysAgo),
    };
  });

  return {
    id,
    youtubeChannelId: pub.youtubeChannelId,
    handle: pub.handle.startsWith('@') ? pub.handle : `@${pub.handle}`,
    name: pub.name,
    nicheTag: params.nicheTag.trim() || 'Geral',
    languageId: params.languageId,
    avatarUrl: pub.avatarUrl,
    subscribersTotal: pub.subscribersTotal,
    viewsTotal: pub.videos.reduce((s, v) => s + v.views, 0),
    videosTotal: pub.videos.length,
    avgViewsRecent,
    videos,
    lastSyncedAt: nowIso,
  };
}

const AUTO_RADAR_STORAGE_KEY = 'open_analytic_auto_radar_v4';

export async function fetchAutonomousNicheRadar(
  market: 'BR' | 'US' | 'FR' | 'ES',
  forceRefresh = false,
  apiKey?: string
): Promise<{ trends: AutoNicheTrend[]; scannedAt: string }> {
  if (!forceRefresh) {
    try {
      const raw = localStorage.getItem(AUTO_RADAR_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<
          string,
          { savedAt: number; scannedAt: string; trends: AutoNicheTrend[] }
        >;
        const cached = parsed[market];
        if (cached && Date.now() - cached.savedAt < 20 * 60 * 1000 && cached.trends.length > 0) {
          return { trends: cached.trends, scannedAt: cached.scannedAt };
        }
      }
    } catch {
      // ignore
    }
  }

  try {
    const res = await fetch(
      `/api/niche-radar?gl=${encodeURIComponent(market)}${forceRefresh ? '&force=1' : ''}`
    );
    const rawText = await res.text();
    if (!rawText.trimStart().startsWith('<')) {
      let data: {
        ok?: boolean;
        scannedAt?: string;
        trends?: AutoNicheTrend[];
        error?: string;
      } = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        data = {};
      }
      if (res.ok && data.trends && data.trends.length > 0) {
        const scannedAt = data.scannedAt || new Date().toISOString();
        try {
          const prevRaw = localStorage.getItem(AUTO_RADAR_STORAGE_KEY);
          const map = prevRaw ? JSON.parse(prevRaw) : {};
          map[market] = { savedAt: Date.now(), scannedAt, trends: data.trends };
          localStorage.setItem(AUTO_RADAR_STORAGE_KEY, JSON.stringify(map));
        } catch {
          // ignore
        }
        return { trends: data.trends, scannedAt };
      }
    }
  } catch {
    // Fallback below if dev server hasn't reloaded vite.config.ts yet
  }

  // Direct 1-quota-unit fallback via YouTube Data API v3 mostPopular chart if apiKey is available
  if (apiKey) {
    const popUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&chart=mostPopular&maxResults=40&regionCode=${encodeURIComponent(
      market
    )}&key=${encodeURIComponent(apiKey)}`;
    const popRes = await fetch(popUrl);
    if (popRes.ok) {
      const popData = (await popRes.json()) as {
        items?: Array<{
          id: string;
          snippet: {
            title: string;
            channelTitle: string;
            categoryId?: string;
            publishedAt: string;
            thumbnails?: { medium?: { url: string }; high?: { url: string } };
          };
          statistics: { viewCount?: string };
          contentDetails: { duration: string };
        }>;
      };

      const catDefs: Record<string, { name: string; icon: string; query: string }> = {
        '27': { name: 'Educação, História & Curiosidades', icon: '🏛️', query: 'historia curiosidades misterios' },
        '28': { name: 'Ciência, IA & Tecnologia', icon: '🤖', query: 'ciencia inteligencia artificial futuro' },
        '24': { name: 'Entretenimento & Storytelling', icon: '🎬', query: 'documentario historias reais' },
        '22': { name: 'Comportamento, Pessoas & Blogs', icon: '🧠', query: 'psicologia comportamento humano' },
        '25': { name: 'Geopolítica, Notícias & Atualidades', icon: '🌍', query: 'geopolitica economia mundo' },
        '26': { name: 'Estilo, Hábitos & Produtividade', icon: '⚡', query: 'habitos mente produtividade' },
        '1': { name: 'Cinema, Animação & Mistérios', icon: '🕵️', query: 'misterios inexplicaveis documentario' },
        '20': { name: 'Gaming & Cultura Pop', icon: '🎮', query: 'curiosidades games historia' },
      };

      const grouped = new Map<string, typeof popData.items>();
      for (const item of popData.items || []) {
        const cid = item.snippet.categoryId || '24';
        const bucket = grouped.get(cid) || [];
        bucket.push(item);
        grouped.set(cid, bucket);
      }

      const nowMs = Date.now();
      const trends: AutoNicheTrend[] = [];
      for (const [cid, list] of grouped.entries()) {
        if (!list || list.length === 0) continue;
        const meta = catDefs[cid] || {
          name: `Tendências Categoria #${cid}`,
          icon: '🔥',
          query: list[0].snippet.title.split(' ').slice(0, 3).join(' '),
        };
        const enriched = list.map((v) => {
          const views = Number(v.statistics.viewCount || 0);
          const daysAgo = Math.max(
            1,
            Math.round((nowMs - new Date(v.snippet.publishedAt).getTime()) / 86400000)
          );
          const durationSec = parseIsoDuration(v.contentDetails.duration);
          return {
            id: v.id,
            title: v.snippet.title,
            channelTitle: v.snippet.channelTitle,
            thumbnailUrl:
              v.snippet.thumbnails?.high?.url || v.snippet.thumbnails?.medium?.url || '',
            views,
            viewsPerDay: Math.round(views / daysAgo),
            daysAgo,
            isShort: durationSec <= 65,
          };
        });
        const sortedV = [...enriched.map((e) => e.views)].sort((a, b) => a - b);
        const med = Math.max(sortedV[Math.floor(sortedV.length / 2)] || 5000, 1000);
        const withOut = enriched
          .map((e) => ({ ...e, outlierScore: Number((e.views / med).toFixed(1)) }))
          .sort((a, b) => b.viewsPerDay - a.viewsPerDay);
        const avgVpd = Math.round(
          withOut.reduce((s, e) => s + e.viewsPerDay, 0) / withOut.length
        );
        const maxOut = Number(Math.max(...withOut.map((e) => e.outlierScore), 1.2).toFixed(1));
        const heatScore = Math.min(
          98,
          Math.max(45, Math.round(Math.log10(Math.max(avgVpd, 100)) * 14 + maxOut * 3))
        );
        trends.push({
          id: `cat-${cid}`,
          name: meta.name,
          icon: meta.icon,
          query: meta.query,
          market,
          heatScore,
          statusLabel: heatScore >= 80 ? 'Explodindo Agora' : 'Em Forte Alta',
          avgViewsPerDay: avgVpd,
          maxOutlier: maxOut,
          recentCount: withOut.length,
          shortsPct: Math.round(
            (withOut.filter((e) => e.isShort).length / withOut.length) * 100
          ),
          estimatedRpm: 4.5,
          competitionLevel: 'Média',
          uniqueChannelsPct: 75,
          risingKeywords: [meta.query],
          topVideo: withOut[0] || null,
          topVideos: withOut.slice(0, 3),
        });
      }

      const ranked = trends
        .sort((a, b) => b.heatScore - a.heatScore || b.avgViewsPerDay - a.avgViewsPerDay)
        .slice(0, 8);
      const scannedAt = new Date().toISOString();
      try {
        const prevRaw = localStorage.getItem(AUTO_RADAR_STORAGE_KEY);
        const map = prevRaw ? JSON.parse(prevRaw) : {};
        map[market] = { savedAt: Date.now(), scannedAt, trends: ranked };
        localStorage.setItem(AUTO_RADAR_STORAGE_KEY, JSON.stringify(map));
      } catch {
        // ignore
      }
      return { trends: ranked, scannedAt };
    }
  }

  // Fallback to previous cached data if temporary network blip
  try {
    const raw = localStorage.getItem(AUTO_RADAR_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, { scannedAt: string; trends: AutoNicheTrend[] }>;
      if (parsed[market]?.trends?.length > 0) {
        return { trends: parsed[market].trends, scannedAt: parsed[market].scannedAt || new Date().toISOString() };
      }
    }
  } catch {
    // ignore
  }

  throw new Error(
    'Reinicie o servidor local (start_open-analytic-yt.bat / npm run dev) para ativar o Radar Autônomo.'
  );
}

const TRENDING_VIDEOS_CACHE_KEY = 'open_analytic_trending_videos_v1';

export type TrendingCategoryFilter =
  | 'all_no_music'
  | 'all'
  | '27'
  | '28'
  | '24'
  | '22'
  | '25';

export async function fetchTopTrendingYouTubeVideos(params: {
  regionCode: 'BR' | 'PT' | 'US' | 'FR' | 'ES';
  categoryFilter: TrendingCategoryFilter;
  apiKey?: string;
  forceRefresh?: boolean;
}): Promise<{ items: TrendingYouTubeVideo[]; source: 'api' | 'public'; fetchedAt: string }> {
  const cacheKey = `${params.regionCode}::${params.categoryFilter}::${
    params.apiKey ? 'api' : 'pub'
  }`;

  if (!params.forceRefresh) {
    try {
      const raw = localStorage.getItem(TRENDING_VIDEOS_CACHE_KEY);
      if (raw) {
        const map = JSON.parse(raw) as Record<
          string,
          {
            savedAt: number;
            fetchedAt: string;
            source: 'api' | 'public';
            items: TrendingYouTubeVideo[];
          }
        >;
        const cached = map[cacheKey];
        if (cached && Date.now() - cached.savedAt < 15 * 60 * 1000 && cached.items.length > 0) {
          return {
            items: cached.items,
            source: cached.source,
            fetchedAt: cached.fetchedAt,
          };
        }
      }
    } catch {
      // ignore
    }
  }

  // 1) Official YouTube Data API v3 chart=mostPopular (only 1-2 quota units!)
  if (params.apiKey) {
    try {
      const isSpecificCat = /^\d+$/.test(params.categoryFilter);
      const catQuery = isSpecificCat
        ? `&videoCategoryId=${encodeURIComponent(params.categoryFilter)}`
        : '';
      const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&chart=mostPopular&maxResults=36&regionCode=${encodeURIComponent(
        params.regionCode
      )}${catQuery}&key=${encodeURIComponent(params.apiKey)}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as {
          items?: Array<{
            id: string;
            snippet: {
              title: string;
              channelId: string;
              channelTitle: string;
              categoryId?: string;
              publishedAt: string;
              thumbnails?: { medium?: { url: string }; high?: { url: string } };
            };
            statistics: {
              viewCount?: string;
              likeCount?: string;
              commentCount?: string;
            };
            contentDetails: { duration: string };
          }>;
        };

        const rawList = (data.items || []).filter((v) =>
          params.categoryFilter === 'all_no_music' ? v.snippet.categoryId !== '10' : true
        );

        const uniqueChIds = Array.from(
          new Set(rawList.map((v) => v.snippet.channelId).filter(Boolean))
        );
        const chMap = new Map<
          string,
          { subs: number; avgViews: number; handle?: string }
        >();

        if (uniqueChIds.length > 0) {
          const chRes = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${uniqueChIds
              .slice(0, 45)
              .join(',')}&key=${encodeURIComponent(params.apiKey)}`
          );
          if (chRes.ok) {
            const chData = (await chRes.json()) as YTChannelResponse;
            for (const c of chData.items || []) {
              const subs = Number(c.statistics.subscriberCount || 0);
              const totalViews = Number(c.statistics.viewCount || 0);
              const totalVids = Math.max(1, Number(c.statistics.videoCount || 1));
              const avgViews =
                totalViews > 0 ? Math.round(totalViews / totalVids) : Math.max(subs, 1000);
              chMap.set(c.id, {
                subs,
                avgViews,
                handle: c.snippet.customUrl,
              });
            }
          }
        }

        const nowMs = Date.now();
        const items: TrendingYouTubeVideo[] = rawList.map((v) => {
          const views = Number(v.statistics.viewCount || 0);
          const likes = Number(v.statistics.likeCount || 0);
          const comments = Number(v.statistics.commentCount || 0);
          const durationSec = parseIsoDuration(v.contentDetails.duration);
          const hoursAgo = Math.max(
            1,
            Math.round((nowMs - new Date(v.snippet.publishedAt).getTime()) / 3600000)
          );
          const chInfo = chMap.get(v.snippet.channelId);
          const baseline = Math.max(chInfo?.avgViews || chInfo?.subs || 10000, 1000);
          const outlierScore = Number((views / baseline).toFixed(1));
          const engagementRate =
            views > 0 ? Number((((likes + comments) / views) * 100).toFixed(2)) : 0;

          return {
            id: v.id,
            title: v.snippet.title,
            channelId: v.snippet.channelId,
            channelTitle: v.snippet.channelTitle,
            channelHandle: chInfo?.handle,
            channelSubs: chInfo?.subs ?? 0,
            categoryId: v.snippet.categoryId || '24',
            publishedAt: v.snippet.publishedAt.slice(0, 10),
            hoursAgo,
            thumbnailUrl:
              v.snippet.thumbnails?.high?.url || v.snippet.thumbnails?.medium?.url || '',
            durationSec,
            isShort: durationSec <= 65,
            views,
            likes,
            comments,
            viewsPerHour: Math.round(views / hoursAgo),
            outlierScore,
            engagementRate,
          };
        });

        const fetchedAt = new Date().toISOString();
        try {
          const prevRaw = localStorage.getItem(TRENDING_VIDEOS_CACHE_KEY);
          const map = prevRaw ? JSON.parse(prevRaw) : {};
          map[cacheKey] = { savedAt: Date.now(), fetchedAt, source: 'api', items };
          localStorage.setItem(TRENDING_VIDEOS_CACHE_KEY, JSON.stringify(map));
        } catch {
          // ignore
        }
        return { items, source: 'api', fetchedAt };
      }
    } catch {
      // Fallback to public server scraper below
    }
  }

  // 2) Zero-quota public server fallback (/api/yt-trending)
  const pubRes = await fetch(
    `/api/yt-trending?gl=${encodeURIComponent(params.regionCode)}&cat=${encodeURIComponent(
      params.categoryFilter
    )}`
  );
  const rawText = await pubRes.text();
  if (rawText.trimStart().startsWith('<')) {
    throw new Error('Configure a YouTube API Key ou reinicie o servidor local.');
  }
  let pubData: {
    items?: Array<{
      id: string;
      title: string;
      channelId: string;
      channelTitle: string;
      channelHandle?: string;
      publishedAt: string;
      daysAgo?: number;
      hoursAgo?: number;
      thumbnailUrl: string;
      durationSec: number;
      isShort: boolean;
      views: number;
    }>;
  } = {};
  try {
    pubData = JSON.parse(rawText);
  } catch {
    throw new Error('Resposta inválida ao buscar vídeos em alta.');
  }

  const list = pubData.items || [];
  const sortedV = [...list.map((x) => x.views)].sort((a, b) => a - b);
  const median = Math.max(sortedV[Math.floor(sortedV.length / 2)] || 25000, 1000);

  const items: TrendingYouTubeVideo[] = list.map((v) => {
    const hoursAgo = Math.max(1, v.hoursAgo || (v.daysAgo || 1) * 24);
    const likes = Math.round(v.views * 0.04);
    const comments = Math.round(v.views * 0.004);
    return {
      id: v.id,
      title: v.title,
      channelId: v.channelId,
      channelTitle: v.channelTitle,
      channelHandle: v.channelHandle,
      channelSubs: 0,
      categoryId: '24',
      publishedAt: v.publishedAt,
      hoursAgo,
      thumbnailUrl: v.thumbnailUrl,
      durationSec: v.durationSec,
      isShort: v.isShort,
      views: v.views,
      likes,
      comments,
      viewsPerHour: Math.round(v.views / hoursAgo),
      outlierScore: Number((v.views / median).toFixed(1)),
      engagementRate: 4.4,
    };
  });

  const fetchedAt = new Date().toISOString();
  return { items, source: 'public', fetchedAt };
}
