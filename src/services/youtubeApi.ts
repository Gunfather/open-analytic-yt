import { Channel, VideoItem } from '../types/youtube';

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
