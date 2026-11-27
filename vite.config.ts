import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import nodemailer from 'nodemailer';

function youtubePublicProxyPlugin(): Plugin {
  return {
    name: 'youtube-public-proxy',
    configureServer(server) {
      server.middlewares.use('/api/yt-public', async (req, res) => {
        try {
          const urlObj = new URL(req.url || '', 'http://localhost');
          const target = (urlObj.searchParams.get('target') || '').trim();
          if (!target) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Parâmetro target obrigatório.' }));
            return;
          }

          const isChannelId = /^UC[\w-]{20,}$/.test(target);
          const ytBase = isChannelId
            ? `https://www.youtube.com/channel/${encodeURIComponent(target)}`
            : `https://www.youtube.com/${target.startsWith('@') ? target : `@${target}`}`;
          const ytUrl = ytBase + (ytBase.includes('?') ? '&' : '?') + 'cbrd=1&ucbcb=1';

          const YT_HEADERS = {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cookie': 'SOCS=CAAaBgiAkKPYBg; PREF=tz=UTC&hl=en;',
          };

          const pageRes = await fetch(ytUrl, {
            headers: YT_HEADERS,
          });

          if (!pageRes.ok) {
            res.statusCode = pageRes.status;
            res.end(JSON.stringify({ error: `YouTube retornou HTTP ${pageRes.status}` }));
            return;
          }

          const html = await pageRes.text();

          const channelIdMatch =
            html.match(/"externalId":"(UC[\w-]{20,})"/) ||
            html.match(/channel_id=(UC[\w-]{20,})/) ||
            html.match(/"browseId":"(UC[\w-]{20,})"/);
          const titleMatch =
            html.match(/"channelProfileMicroformatDetails":\{"profilePage":\{.*?"name":"([^"]+?)(?: - YouTube)?"/) ||
            html.match(/<meta property="og:title" content="([^"]+)"/) ||
            html.match(/"title":"([^"]+)"/);
          const avatarMatch =
            html.match(/"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/) ||
            html.match(/<meta property="og:image" content="([^"]+)"/);
          const subsMatch = html.match(/"subscriberCountText":\{"simpleText":"([^"]+)"/);

          const resolvedChannelId = channelIdMatch?.[1] || (isChannelId ? target : '');
          const name = titleMatch?.[1] || target;
          const avatarUrl = avatarMatch?.[1] || '';

          // Parse compact subscriber count like "1.23M subscribers" or "450K subscribers"
          let subscribersTotal = 0;
          if (subsMatch?.[1]) {
            const numPart = subsMatch[1].replace(/subscribers?/i, '').trim();
            const mult = /M/i.test(numPart)
              ? 1_000_000
              : /K/i.test(numPart)
              ? 1_000
              : 1;
            const parsed = parseFloat(numPart.replace(/[^0-9.]/g, ''));
            if (!Number.isNaN(parsed)) {
              subscribersTotal = Math.round(parsed * mult);
            }
          }

          // Fetch YouTube RSS feed for recent 15 videos (no API key required)
          const videos: Array<{
            id: string;
            title: string;
            publishedAt: string;
            thumbnailUrl: string;
            views: number;
            likes: number;
          }> = [];

          if (resolvedChannelId) {
            const rssRes = await fetch(
              `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(
                resolvedChannelId
              )}`,
              { headers: YT_HEADERS }
            );
            if (rssRes.ok) {
              const xml = await rssRes.text();
              const entries = xml.split('<entry>').slice(1);
              for (const entry of entries) {
                const vidId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1] || '';
                const vidTitle =
                  entry.match(/<title>([^<]+)<\/title>/)?.[1] || 'Sem título';
                const pub =
                  entry.match(/<published>([^<]+)<\/published>/)?.[1]?.slice(0, 10) ||
                  new Date().toISOString().slice(0, 10);
                const thumb =
                  entry.match(/<media:thumbnail url="([^"]+)"/)?.[1] || '';
                const views = parseInt(
                  entry.match(/<media:statistics views="(\d+)"/)?.[1] || '0',
                  10
                );
                const likes = parseInt(
                  entry.match(/<media:starRating count="(\d+)"/)?.[1] || '0',
                  10
                );
                if (vidId) {
                  videos.push({
                    id: vidId,
                    title: vidTitle,
                    publishedAt: pub,
                    thumbnailUrl: thumb,
                    views,
                    likes,
                  });
                }
              }
            }
          }

          // Also check /shorts page on the channel (since YouTube RSS feed never contains Shorts!)
          const shortsUrl = ytBase.replace(/\/shorts.*$/, '') + '/shorts?cbrd=1&ucbcb=1';

          try {
            const shortsRes = await fetch(shortsUrl, {
              headers: YT_HEADERS,
            });
            if (shortsRes.ok) {
              const shortsHtml = await shortsRes.text();
              // Pattern 1: reelItemRenderer
              const reelRegex =
                /"reelItemRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})"[^}]*?"headline":\{"simpleText":"([^"]+)"\}/g;
              let rm;
              while ((rm = reelRegex.exec(shortsHtml)) !== null) {
                const vidId = rm[1];
                const vidTitle = rm[2].replace(/\\u0026/g, '&');
                if (!videos.some((v) => v.id === vidId)) {
                  videos.push({
                    id: vidId,
                    title: vidTitle.toLowerCase().includes('#shorts')
                      ? vidTitle
                      : `${vidTitle} #shorts`,
                    publishedAt: new Date().toISOString().slice(0, 10),
                    thumbnailUrl: `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`,
                    views: 0,
                    likes: 0,
                  });
                }
              }

              // Pattern 2: accessibilityText
              const lockupRegex =
                /"reelWatchEndpoint":\{"videoId":"([a-zA-Z0-9_-]{11})"[^}]*?\}.*?"accessibilityText":"([^"]+)"/g;
              let lm;
              while ((lm = lockupRegex.exec(shortsHtml)) !== null) {
                const vidId = lm[1];
                const rawTitle = lm[2].replace(/\\u0026/g, '&');
                const cleanTitle = rawTitle
                  .replace(/\s*-\s*play Short.*$/i, '')
                  .replace(/,\s*[\d,KM.]+\s*views.*$/i, '')
                  .trim();
                
                let parsedViews = 0;
                const vMatch = rawTitle.match(/([\d,.]+)\s*([KkMmBb]?)\s*views?/i);
                if (vMatch) {
                  const num = parseFloat(vMatch[1].replace(/,/g, ''));
                  const unit = vMatch[2]?.toUpperCase();
                  const mult = unit === 'M' ? 1_000_000 : unit === 'K' ? 1_000 : unit === 'B' ? 1_000_000_000 : 1;
                  parsedViews = Math.round(num * mult);
                }

                if (!videos.some((v) => v.id === vidId)) {
                  videos.push({
                    id: vidId,
                    title: cleanTitle.toLowerCase().includes('#shorts')
                      ? cleanTitle
                      : `${cleanTitle} #shorts`,
                    publishedAt: new Date().toISOString().slice(0, 10),
                    thumbnailUrl: `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`,
                    views: parsedViews,
                    likes: 0,
                  });
                }
              }

              // Pattern 3: Fallback any videoId inside /shorts/ link or context
              const fallbackShorts = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
              let fm;
              const foundIds = new Set<string>();
              while ((fm = fallbackShorts.exec(shortsHtml)) !== null) {
                const vidId = fm[1];
                if (
                  vidId.length === 11 &&
                  !videos.some((v) => v.id === vidId) &&
                  !foundIds.has(vidId)
                ) {
                  foundIds.add(vidId);
                  videos.push({
                    id: vidId,
                    title: `Short #${vidId.slice(0, 6)} #shorts`,
                    publishedAt: new Date().toISOString().slice(0, 10),
                    thumbnailUrl: `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`,
                    views: 0,
                    likes: 0,
                  });
                  if (foundIds.size >= 10) break;
                }
              }
            }
          } catch (shortsErr) {
            console.error('Error fetching shorts tab:', shortsErr);
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              youtubeChannelId: resolvedChannelId,
              name,
              handle: target.startsWith('@') ? target : `@${name.replace(/\s+/g, '')}`,
              avatarUrl,
              subscribersTotal,
              videos,
            })
          );
        } catch (err) {
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : 'Erro no proxy público',
            })
          );
        }
      });

      // Individual video lookup endpoint for manual import
      server.middlewares.use('/api/yt-video', async (req, res) => {
        try {
          const urlObj = new URL(req.url || '', 'http://localhost');
          const videoParam = (
            urlObj.searchParams.get('url') ||
            urlObj.searchParams.get('id') ||
            ''
          ).trim();
          if (!videoParam) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Parâmetro url ou id obrigatório.' }));
            return;
          }

          let videoId = videoParam;
          const match =
            videoParam.match(/(?:shorts\/|v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/) ||
            videoParam.match(/^([a-zA-Z0-9_-]{11})$/);
          if (match?.[1]) {
            videoId = match[1];
          }

          if (videoId.length !== 11) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'ID ou Link do vídeo do YouTube inválido.' }));
            return;
          }

          // 1) Fetch oEmbed for official video title, author, thumbnail
          let title = `Vídeo ${videoId}`;
          let author = '';
          let thumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
          try {
            const oembedRes = await fetch(
              `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(
                videoId
              )}&format=json`,
              {
                headers: {
                  'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
                  Cookie: 'SOCS=CAAaBgiAkKPYBg; PREF=tz=UTC&hl=en;',
                },
              }
            );
            if (oembedRes.ok) {
              const oembedData = (await oembedRes.json()) as {
                title?: string;
                author_name?: string;
                thumbnail_url?: string;
              };
              if (oembedData.title) title = oembedData.title;
              if (oembedData.author_name) author = oembedData.author_name;
              if (oembedData.thumbnail_url) thumb = oembedData.thumbnail_url;
            }
          } catch {}

          // 2) Fetch watch page to parse actual view count and likes
          let realViews = 0;
          let realLikes = 0;
          try {
            const watchRes = await fetch(
              `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&cbrd=1&ucbcb=1`,
              {
                headers: {
                  'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
                  'Accept-Language': 'en-US,en;q=0.9',
                  Cookie: 'SOCS=CAAaBgiAkKPYBg; PREF=tz=UTC&hl=en;',
                },
              }
            );
            if (watchRes.ok) {
              const watchHtml = await watchRes.text();
              const vMatch =
                watchHtml.match(/"viewCount":"(\d+)"/) ||
                watchHtml.match(/"simpleText":"([\d,.]+)\s*views?"/i) ||
                watchHtml.match(/"label":"([\d,.]+)\s*views?"/i);
              if (vMatch) {
                realViews = parseInt(vMatch[1].replace(/[^0-9]/g, ''), 10) || 0;
              }
              const lMatch =
                watchHtml.match(/"accessibilityData":\{"label":"([\d,.]+)\s*likes?"/i) ||
                watchHtml.match(/"defaultText":\{"accessibility":\{"accessibilityData":\{"label":"([\d,.]+)\s*likes?"/i);
              if (lMatch) {
                realLikes = parseInt(lMatch[1].replace(/[^0-9]/g, ''), 10) || 0;
              }
            }
          } catch {}

          const isShort =
            videoParam.toLowerCase().includes('shorts') ||
            title.toLowerCase().includes('#shorts');

          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              id: videoId,
              title,
              author,
              publishedAt: new Date().toISOString().slice(0, 10),
              thumbnailUrl: thumb,
              durationSec: isShort ? 50 : 360,
              isShort,
              views: realViews > 0 ? realViews : 1,
              likes: realLikes,
            })
          );
        } catch (err) {
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : 'Erro ao buscar vídeo',
            })
          );
        }
      });

      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      async function mapWithConcurrency<T, R>(
        items: readonly T[],
        concurrency: number,
        staggerMs: number,
        worker: (item: T, index: number) => Promise<R>
      ): Promise<R[]> {
        const results: R[] = new Array(items.length);
        let cursor = 0;
        const runners = Array.from({ length: Math.min(concurrency, items.length) }, async (_, rIdx) => {
          if (rIdx > 0) await sleep(rIdx * staggerMs);
          while (true) {
            const idx = cursor++;
            if (idx >= items.length) break;
            results[idx] = await worker(items[idx], idx);
            if (staggerMs > 0) await sleep(staggerMs);
          }
        });
        await Promise.all(runners);
        return results;
      }

      const fetchYouTubeSuggest = async (q: string, gl: string, hl: string): Promise<string[]> => {
        try {
          const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=${encodeURIComponent(
            hl
          )}&gl=${encodeURIComponent(gl)}&q=${encodeURIComponent(q)}`;
          const r = await fetch(url, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            },
          });
          if (!r.ok) return [];
          const json = (await r.json()) as [string, string[]];
          return Array.isArray(json?.[1])
            ? json[1].map((s) => String(s).trim()).filter((s) => s.length > 3)
            : [];
        } catch {
          return [];
        }
      };

      const scrapePublicYouTubeSearch = async (q: string, gl: string, hl: string, attempt = 0): Promise<Array<{
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
      }>> => {
        const ytSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
          q
        )}&gl=${encodeURIComponent(gl)}&hl=${encodeURIComponent(hl)}`;

        const pageRes = await fetch(ytSearchUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': `${hl},en-US;q=0.8,en;q=0.7`,
            Cookie:
              'SOCS=CAISHAgBEhJnd3NfMjAyMzA4MTAtMF9SQzIaAmVuIAEaBgiAo_CmBg; CONSENT=YES+cb',
          },
        });

        if (!pageRes.ok) {
          if (attempt < 1) {
            await sleep(350);
            return scrapePublicYouTubeSearch(q, gl, hl, attempt + 1);
          }
          throw new Error(`YouTube search HTTP ${pageRes.status}`);
        }

        const html = await pageRes.text();
        const marker = 'var ytInitialData = ';
        let startIdx = html.indexOf(marker);
        let offset = marker.length;
        if (startIdx === -1) {
          const altMarker = 'window["ytInitialData"] = ';
          startIdx = html.indexOf(altMarker);
          offset = altMarker.length;
        }
        if (startIdx === -1) {
          if (attempt < 1) {
            await sleep(350);
            return scrapePublicYouTubeSearch(q, gl, hl, attempt + 1);
          }
          return [];
        }

        const afterMarker = html.slice(startIdx + offset);
        let endIdx = afterMarker.indexOf(';</script>');
        if (endIdx === -1) {
          endIdx = afterMarker.indexOf('</script>');
        }
        const jsonStr = endIdx !== -1 ? afterMarker.slice(0, endIdx).trim().replace(/;$/, '') : '';
        let initialData: unknown = {};
        try {
          initialData = jsonStr ? JSON.parse(jsonStr) : {};
        } catch {
          if (attempt < 1) {
            await sleep(350);
            return scrapePublicYouTubeSearch(q, gl, hl, attempt + 1);
          }
          return [];
        }

        const renderers: Array<Record<string, unknown>> = [];
        const collectVideoRenderers = (node: unknown) => {
          if (!node || typeof node !== 'object') return;
          if (Array.isArray(node)) {
            for (const item of node) collectVideoRenderers(item);
            return;
          }
          const obj = node as Record<string, unknown>;
          if (obj.videoRenderer && typeof obj.videoRenderer === 'object') {
            renderers.push(obj.videoRenderer as Record<string, unknown>);
            return;
          }
          for (const val of Object.values(obj)) {
            if (renderers.length < 28) collectVideoRenderers(val);
          }
        };
        collectVideoRenderers(initialData);

        const parseCompactViews = (raw: string): number => {
          if (!raw) return 0;
          const lower = raw.toLowerCase();
          if (lower.includes('no view') || lower.includes('nenhuma') || lower.includes('aucune')) {
            return 0;
          }
          const clean = lower.replace(/\s+/g, ' ');
          let mult = 1;
          if (/\bmi\b|\bm\b|million|milh/i.test(clean)) mult = 1_000_000;
          else if (/\bk\b|\bmil\b/i.test(clean)) mult = 1_000;

          if (mult > 1) {
            const numMatch = clean.match(/(\d+(?:[.,]\d+)?)/);
            if (!numMatch) return 0;
            const normalized = numMatch[1].replace(',', '.');
            return Math.round(parseFloat(normalized) * mult);
          }
          const digits = clean.replace(/[^\d]/g, '');
          return digits ? parseInt(digits, 10) : 0;
        };

        const parseDurationText = (raw: string): number => {
          if (!raw) return 180;
          const parts = raw.split(':').map((p) => parseInt(p.trim(), 10) || 0);
          if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
          if (parts.length === 2) return parts[0] * 60 + parts[1];
          return parts[0] || 60;
        };

        const parseDaysAgo = (raw: string): number => {
          const s = (raw || '').toLowerCase();
          const n = parseInt(s.match(/(\d+)/)?.[1] || '1', 10);
          if (/hour|hora|heure|min/i.test(s)) return 1;
          if (/day|dia|jour|d\u00eda/i.test(s)) return Math.max(1, n);
          if (/week|semana|semaine/i.test(s)) return n * 7;
          if (/month|m\u00eas|mes|mois/i.test(s)) return n * 30;
          if (/year|ano|an|a\u00f1o/i.test(s)) return n * 365;
          return 14;
        };

        const parsedItems = renderers
          .slice(0, 24)
          .map((vr: any) => {
            const videoId = String(vr.videoId || '');
            const title =
              vr.title?.runs?.map((r: any) => r.text).join('') ||
              vr.title?.simpleText ||
              'Sem título';
            const channelRun = vr.ownerText?.runs?.[0] || vr.longBylineText?.runs?.[0];
            const channelTitle = channelRun?.text || 'Canal';
            const browseId =
              channelRun?.navigationEndpoint?.browseEndpoint?.browseId || '';
            const canonicalUrl =
              channelRun?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl || '';
            const channelHandle = canonicalUrl.startsWith('/@')
              ? canonicalUrl.slice(1)
              : undefined;
            const viewText =
              vr.viewCountText?.simpleText ||
              vr.viewCountText?.runs?.map((r: any) => r.text).join('') ||
              '0';
            const views = parseCompactViews(viewText);
            const lengthText = vr.lengthText?.simpleText || '';
            const isShortOverlay =
              Boolean(vr.navigationEndpoint?.reelWatchEndpoint) ||
              JSON.stringify(vr.thumbnailOverlays || []).includes('SHORTS');
            const durationSec = isShortOverlay && !lengthText ? 45 : parseDurationText(lengthText);
            const pubText = vr.publishedTimeText?.simpleText || '';
            const daysAgo = parseDaysAgo(pubText);
            const pubDate = new Date(Date.now() - daysAgo * 86400000)
              .toISOString()
              .slice(0, 10);
            const thumbs = vr.thumbnail?.thumbnails || [];
            const thumbnailUrl =
              thumbs[thumbs.length - 1]?.url ||
              `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;

            return {
              id: videoId,
              title,
              channelId: browseId,
              channelTitle,
              channelHandle,
              publishedAt: pubDate,
              daysAgo,
              thumbnailUrl,
              durationSec,
              isShort: isShortOverlay || durationSec <= 65,
              views,
            };
          })
          .filter((item) => Boolean(item.id) && item.views > 0);

        if (parsedItems.length === 0 && attempt < 1) {
          await sleep(350);
          return scrapePublicYouTubeSearch(q, gl, hl, attempt + 1);
        }
        return parsedItems;
      };

      const radarMemoryCache = new Map<
        string,
        { savedAt: number; scannedAt: string; trends: any[] }
      >();

      const MARKET_RPM_FACTOR: Record<'BR' | 'US' | 'FR' | 'ES', number> = {
        US: 1.0,
        FR: 0.72,
        ES: 0.46,
        BR: 0.38,
      };

      const AUTO_NICHE_SEEDS = [
        {
          id: 'biblical-arch',
          icon: '🏺',
          baseUsRpm: 7.2,
          suggestStem: {
            BR: 'arqueologia biblica ',
            US: 'biblical archaeology ',
            FR: 'archeologie biblique ',
            ES: 'arqueologia biblica ',
          },
          names: {
            BR: 'Arqueologia & Enigmas Bíblicos',
            US: 'Biblical Archaeology & Mysteries',
            FR: 'Archéologie & Mystères Bibliques',
            ES: 'Arqueología & Misterios Bíblicos',
          },
          queries: {
            BR: 'arqueologia biblica misterios descoberta',
            US: 'biblical archaeology mysteries discovery',
            FR: 'archeologie biblique mysteres histoire',
            ES: 'arqueologia biblica misterios historia',
          },
        },
        {
          id: 'ancient-civ',
          icon: '🏛️',
          baseUsRpm: 6.8,
          suggestStem: {
            BR: 'civilizacoes antigas ',
            US: 'ancient civilizations ',
            FR: 'civilisations anciennes ',
            ES: 'civilizaciones antiguas ',
          },
          names: {
            BR: 'Civilizações Antigas & História',
            US: 'Ancient Civilizations & Lost History',
            FR: 'Civilisations Anciennes & Histoire',
            ES: 'Civilizaciones Antiguas & Historia',
          },
          queries: {
            BR: 'civilizacoes antigas historia proibida documentario',
            US: 'ancient civilizations lost history documentary',
            FR: 'civilisations anciennes histoire documentaire',
            ES: 'civilizaciones antiguas historia documental',
          },
        },
        {
          id: 'dark-psych',
          icon: '🧠',
          baseUsRpm: 6.4,
          suggestStem: {
            BR: 'psicologia comportamento ',
            US: 'human psychology ',
            FR: 'psychologie comportement ',
            ES: 'psicologia comportamiento ',
          },
          names: {
            BR: 'Psicologia & Comportamento Humano',
            US: 'Human Behavior & Psychology',
            FR: 'Psychologie & Comportement Humain',
            ES: 'Psicología & Comportamiento Humano',
          },
          queries: {
            BR: 'psicologia comportamento humano mente fatos',
            US: 'human behavior psychology facts mind',
            FR: 'psychologie comportement humain faits',
            ES: 'psicologia comportamiento humano mente',
          },
        },
        {
          id: 'unsolved-mysteries',
          icon: '🕵️',
          baseUsRpm: 6.9,
          suggestStem: {
            BR: 'misterios inexplicaveis ',
            US: 'unsolved mysteries ',
            FR: 'mysteres inexpliques ',
            ES: 'misterios sin resolver ',
          },
          names: {
            BR: 'Mistérios & Casos Inexplicáveis',
            US: 'Unsolved Mysteries & Cold Cases',
            FR: 'Mystères Inexpliqués & Enquêtes',
            ES: 'Misterios Sin Resolver & Casos',
          },
          queries: {
            BR: 'misterios inexplicaveis casos reais documentario',
            US: 'unsolved mysteries documentary strange cases',
            FR: 'mysteres inexpliques documentaire histoire',
            ES: 'misterios sin resolver casos documentales',
          },
        },
        {
          id: 'space-cosmos',
          icon: '🌌',
          baseUsRpm: 7.8,
          suggestStem: {
            BR: 'descoberta universo ',
            US: 'james webb discovery ',
            FR: 'decouverte univers ',
            ES: 'descubrimiento universo ',
          },
          names: {
            BR: 'Universo, Espaço & Astronomia',
            US: 'Space, Cosmos & James Webb',
            FR: 'Univers, Espace & Astronomie',
            ES: 'Universo, Espacio & Astronomía',
          },
          queries: {
            BR: 'universo espaco descoberta telescopio astronomia',
            US: 'james webb space discovery universe documentary',
            FR: 'univers espace decouverte astronomie',
            ES: 'universo espacio descubrimiento astronomia',
          },
        },
        {
          id: 'ai-future',
          icon: '🤖',
          baseUsRpm: 10.5,
          suggestStem: {
            BR: 'inteligencia artificial ',
            US: 'ai agents future ',
            FR: 'intelligence artificielle ',
            ES: 'inteligencia artificial ',
          },
          names: {
            BR: 'IA, Robótica & Futuro',
            US: 'AI Breakthroughs & Future Tech',
            FR: 'IA, Robotique & Futur',
            ES: 'IA, Robótica & Futuro',
          },
          queries: {
            BR: 'inteligencia artificial futuro tecnologia',
            US: 'ai breakthrough future technology documentary',
            FR: 'intelligence artificielle futur technologie',
            ES: 'inteligencia artificial futuro tecnologia',
          },
        },
        {
          id: 'geopolitics-econ',
          icon: '🌍',
          baseUsRpm: 9.8,
          suggestStem: {
            BR: 'geopolitica economia ',
            US: 'geopolitics economy ',
            FR: 'geopolitique economie ',
            ES: 'geopolitica economia ',
          },
          names: {
            BR: 'Geopolítica & Economia Global',
            US: 'Geopolitics & Global Economy',
            FR: 'Géopolitique & Économie Mondiale',
            ES: 'Geopolítica & Economía Global',
          },
          queries: {
            BR: 'geopolitica mundial economia historia',
            US: 'geopolitics global economy documentary',
            FR: 'geopolitique economie mondiale documentaire',
            ES: 'geopolitica economia mundial documental',
          },
        },
        {
          id: 'neuro-longevity',
          icon: '🧬',
          baseUsRpm: 8.6,
          suggestStem: {
            BR: 'neurociencia cerebro ',
            US: 'neuroscience brain ',
            FR: 'neurosciences cerveau ',
            ES: 'neurociencia cerebro ',
          },
          names: {
            BR: 'Neurociência, Corpo & Longevidade',
            US: 'Neuroscience, Brain & Longevity',
            FR: 'Neurosciences, Cerveau & Santé',
            ES: 'Neurociencia, Cerebro & Longevidad',
          },
          queries: {
            BR: 'neurociencia cerebro dopamina habitos ciencia',
            US: 'neuroscience brain dopamine longevity science',
            FR: 'neurosciences cerveau habitudes sante',
            ES: 'neurociencia cerebro dopamina salud',
          },
        },
        {
          id: 'stoicism-philo',
          icon: '🗿',
          baseUsRpm: 6.2,
          suggestStem: {
            BR: 'filosofia estoicismo ',
            US: 'stoicism philosophy ',
            FR: 'philosophie stoicisme ',
            ES: 'filosofia estoicismo ',
          },
          names: {
            BR: 'Filosofia, Estoicismo & Sabedoria',
            US: 'Philosophy, Stoicism & Wisdom',
            FR: 'Philosophie, Stoïcisme & Sagesse',
            ES: 'Filosofía, Estoicismo & Sabiduría',
          },
          queries: {
            BR: 'estoicismo filosofia sabedoria antiga mente',
            US: 'stoicism ancient philosophy wisdom life',
            FR: 'stoicisme philosophie sagesse antique',
            ES: 'estoicismo filosofia sabiduria antigua',
          },
        },
        {
          id: 'wealth-empires',
          icon: '💎',
          baseUsRpm: 12.4,
          suggestStem: {
            BR: 'historia dos bilionarios ',
            US: 'rise and fall business ',
            FR: 'histoire entreprise fortune ',
            ES: 'historia imperios financieros ',
          },
          names: {
            BR: 'Finanças, Impérios & Negócios',
            US: 'Financial Empires & Business Docs',
            FR: 'Empires Financiers & Business',
            ES: 'Imperios Financieros & Negocios',
          },
          queries: {
            BR: 'ascensao e queda empresas dinheiro documentario',
            US: 'rise and fall company documentary finance',
            FR: 'ascension et chute entreprise documentaire',
            ES: 'ascenso y caida empresas documental finanzas',
          },
        },
      ] as const;

      const DISCOVERY_STEMS: Record<'BR' | 'US' | 'FR' | 'ES', string[]> = {
        BR: ['documentario misterio ', 'historia proibida ', 'curiosidades sobre o '],
        US: ['why nobody talks about ', 'untold history documentary ', 'mystery of the '],
        FR: ['documentaire mystere ', 'histoire interdite ', 'le secret de '],
        ES: ['documental misterio ', 'historia prohibida ', 'el secreto de '],
      };

      const evaluateScrapedPool = (
        allItems: Awaited<ReturnType<typeof scrapePublicYouTubeSearch>>,
        meta: {
          id: string;
          name: string;
          icon: string;
          query: string;
          market: 'BR' | 'US' | 'FR' | 'ES';
          estimatedRpm: number;
          isEmergentDiscovery?: boolean;
          risingKeywords: string[];
        }
      ) => {
        const recent = allItems.filter((v) => v.daysAgo <= 60 && v.views > 0);
        const pool = recent.length >= 3 ? recent : allItems.filter((v) => v.views > 0);

        if (pool.length === 0) {
          return null;
        }

        const sortedViews = [...pool.map((i) => i.views)].sort((a, b) => a - b);
        const medianViews = Math.max(
          sortedViews[Math.floor(sortedViews.length / 2)] || 1500,
          250
        );

        const uniqueChannels = new Set(
          pool.map((v) => v.channelId || v.channelTitle.toLowerCase())
        ).size;
        const uniqueChannelsPct = Math.round((uniqueChannels / pool.length) * 100);

        const enriched = pool.map((v) => {
          const days = Math.max(1, v.daysAgo);
          const viewsPerDay = Math.round(v.views / days);
          const outlierScore = Number((v.views / medianViews).toFixed(1));
          return { ...v, viewsPerDay, outlierScore };
        });

        const avgViewsPerDay = Math.round(
          enriched.reduce((s, v) => s + v.viewsPerDay, 0) / enriched.length
        );
        const sortedByVelocity = [...enriched].sort(
          (a, b) =>
            b.viewsPerDay * Math.min(b.outlierScore, 8) -
            a.viewsPerDay * Math.min(a.outlierScore, 8)
        );
        const maxOutlier = Number(
          Math.max(...enriched.map((e) => e.outlierScore), 1.1).toFixed(1)
        );
        const breakoutsCount = enriched.filter(
          (e) => e.daysAgo <= 30 && e.outlierScore >= 1.6
        ).length;
        const shortsPct = Math.round(
          (enriched.filter((e) => e.isShort).length / enriched.length) * 100
        );

        const velScore = Math.min(
          46,
          Math.round(Math.log10(Math.max(avgViewsPerDay, 20)) * 10.2)
        );
        const outScore = Math.min(30, Math.round(maxOutlier * 3.8));
        const freshScore = Math.min(15, breakoutsCount * 3.5);
        const diversityBonus = uniqueChannelsPct >= 75 ? 8 : uniqueChannelsPct >= 55 ? 4 : 0;
        const heatScore = Math.max(
          38,
          Math.min(99, Math.round(velScore + outScore + freshScore + diversityBonus))
        );

        const competitionLevel: 'Baixa' | 'Média' | 'Alta' =
          uniqueChannelsPct >= 75 && maxOutlier >= 3
            ? 'Baixa'
            : uniqueChannelsPct >= 55
            ? 'Média'
            : 'Alta';

        const statusLabel =
          heatScore >= 84
            ? 'Explodindo Agora'
            : heatScore >= 70
            ? 'Em Forte Alta'
            : heatScore >= 56
            ? 'Acelerando'
            : 'Oportunidade Estável';

        const topSamples = sortedByVelocity.slice(0, 3).map((v) => ({
          id: v.id,
          title: v.title,
          channelTitle: v.channelTitle,
          thumbnailUrl: v.thumbnailUrl,
          views: v.views,
          viewsPerDay: v.viewsPerDay,
          daysAgo: v.daysAgo,
          outlierScore: v.outlierScore,
          isShort: v.isShort,
        }));

        return {
          id: meta.id,
          name: meta.name,
          icon: meta.icon,
          query: meta.query,
          market: meta.market,
          heatScore,
          statusLabel,
          avgViewsPerDay,
          maxOutlier,
          recentCount: enriched.filter((e) => e.daysAgo <= 30).length,
          shortsPct,
          estimatedRpm: meta.estimatedRpm,
          competitionLevel,
          uniqueChannelsPct,
          isEmergentDiscovery: Boolean(meta.isEmergentDiscovery),
          risingKeywords: meta.risingKeywords.slice(0, 4),
          topVideo: topSamples[0] || null,
          topVideos: topSamples,
        };
      };

      server.middlewares.use('/api/niche-radar', async (req, res) => {
        try {
          const urlObj = new URL(req.url || '', 'http://localhost');
          const rawMarket = (urlObj.searchParams.get('gl') || 'BR').toUpperCase();
          const market = (
            ['BR', 'US', 'FR', 'ES'].includes(rawMarket) ? rawMarket : 'BR'
          ) as 'BR' | 'US' | 'FR' | 'ES';
          const force = urlObj.searchParams.get('force') === '1';
          const hlMap: Record<'BR' | 'US' | 'FR' | 'ES', string> = {
            BR: 'pt',
            US: 'en',
            FR: 'fr',
            ES: 'es',
          };

          const cached = radarMemoryCache.get(market);
          if (!force && cached && Date.now() - cached.savedAt < 20 * 60 * 1000) {
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                ok: true,
                market,
                scannedAt: cached.scannedAt,
                fromCache: true,
                trends: cached.trends,
              })
            );
            return;
          }

          // 1) Autonomous Open-World Discovery via real-time YouTube Autocomplete Stems
          const stemSuggestionsNested = await Promise.all(
            DISCOVERY_STEMS[market].map((stem) =>
              fetchYouTubeSuggest(stem, market, hlMap[market])
            )
          );
          const discoveredQueries = Array.from(
            new Set(stemSuggestionsNested.flat())
          ).slice(0, 2);

          // 2) Scan Core 10 Verticals with controlled concurrency (3 at a time) -> 0 throttling!
          const rpmFactor = MARKET_RPM_FACTOR[market];
          const coreResults = await mapWithConcurrency(
            AUTO_NICHE_SEEDS,
            2,
            180,
            async (seed) => {
              const q = seed.queries[market];
              const [items, suggestions] = await Promise.all([
                scrapePublicYouTubeSearch(q, market, hlMap[market]).catch(() => []),
                fetchYouTubeSuggest(seed.suggestStem[market], market, hlMap[market]),
              ]);
              return evaluateScrapedPool(items, {
                id: seed.id,
                name: seed.names[market],
                icon: seed.icon,
                query: q,
                market,
                estimatedRpm: Number((seed.baseUsRpm * rpmFactor).toFixed(2)),
                risingKeywords: suggestions,
              });
            }
          );

          // 3) Scan Autonomous Emergent Micro-Niches discovered from live YouTube Suggest
          const emergentResults = await mapWithConcurrency(
            discoveredQueries,
            2,
            130,
            async (discQuery, idx) => {
              const [items, related] = await Promise.all([
                scrapePublicYouTubeSearch(discQuery, market, hlMap[market]).catch(() => []),
                fetchYouTubeSuggest(discQuery, market, hlMap[market]),
              ]);
              const formattedTitle =
                discQuery.charAt(0).toUpperCase() + discQuery.slice(1);
              return evaluateScrapedPool(items, {
                id: `emergent-${idx}-${Date.now()}`,
                name: formattedTitle,
                icon: '🚀',
                query: discQuery,
                market,
                estimatedRpm: Number((7.0 * rpmFactor).toFixed(2)),
                isEmergentDiscovery: true,
                risingKeywords: related,
              });
            }
          );

          let validTrends = [...coreResults, ...emergentResults].filter(
            (x): x is NonNullable<typeof x> => x !== null
          );

          // 4) Compute US Arbitrage Gap if user is browsing BR, FR, or ES and US cache exists (or warm US background)
          if (market !== 'US') {
            const usCached = radarMemoryCache.get('US');
            if (usCached) {
              const usMap = new Map(
                usCached.trends.map((t: any) => [t.id, t.avgViewsPerDay || 0])
              );
              validTrends = validTrends.map((t) => {
                const usVel = Number(usMap.get(t.id) || 0);
                const gap =
                  usVel > 0
                    ? Number((usVel / Math.max(t.avgViewsPerDay, 300)).toFixed(1))
                    : undefined;
                return gap && gap >= 1.5 ? { ...t, usArbitrageGap: gap } : t;
              });
            } else {
              // Warm US cache asynchronously in background without blocking current response!
              void (async () => {
                try {
                  const usRes = await mapWithConcurrency(
                    AUTO_NICHE_SEEDS.slice(0, 6),
                    2,
                    200,
                    async (seed) => {
                      const items = await scrapePublicYouTubeSearch(
                        seed.queries.US,
                        'US',
                        'en'
                      ).catch(() => []);
                      return evaluateScrapedPool(items, {
                        id: seed.id,
                        name: seed.names.US,
                        icon: seed.icon,
                        query: seed.queries.US,
                        market: 'US',
                        estimatedRpm: seed.baseUsRpm,
                        risingKeywords: [],
                      });
                    }
                  );
                  const cleanUs = usRes.filter(Boolean);
                  if (cleanUs.length > 0) {
                    radarMemoryCache.set('US', {
                      savedAt: Date.now(),
                      scannedAt: new Date().toISOString(),
                      trends: cleanUs,
                    });
                  }
                } catch {
                  // ignore background warm errors
                }
              })();
            }
          }

          const ranked = validTrends.sort(
            (a, b) => b.heatScore - a.heatScore || b.avgViewsPerDay - a.avgViewsPerDay
          );
          const scannedAt = new Date().toISOString();
          radarMemoryCache.set(market, { savedAt: Date.now(), scannedAt, trends: ranked });

          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              ok: true,
              market,
              scannedAt,
              fromCache: false,
              trends: ranked,
            })
          );
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : 'Erro no Radar Autônomo de Nichos',
            })
          );
        }
      });

      server.middlewares.use('/api/yt-search', async (req, res) => {
        try {
          const urlObj = new URL(req.url || '', 'http://localhost');
          const q = (urlObj.searchParams.get('q') || '').trim();
          const gl = (urlObj.searchParams.get('gl') || 'US').trim();
          const hl = (urlObj.searchParams.get('hl') || 'en').trim();

          if (!q) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Parâmetro q obrigatório.' }));
            return;
          }

          const items = await scrapePublicYouTubeSearch(q, gl, hl);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ items }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : 'Erro na pesquisa pública do YouTube',
            })
          );
        }
      });

      server.middlewares.use('/api/yt-trending', async (req, res) => {
        try {
          const urlObj = new URL(req.url || '', 'http://localhost');
          const gl = (urlObj.searchParams.get('gl') || 'BR').toUpperCase();
          const cat = urlObj.searchParams.get('cat') || 'all_no_music';
          const hlMap: Record<string, string> = {
            BR: 'pt',
            PT: 'pt-PT',
            US: 'en',
            FR: 'fr',
            ES: 'es',
          };
          const hl = hlMap[gl] || 'en';

          const catQueries: Record<string, Record<string, string>> = {
            '27': {
              BR: 'documentario historia curiosidades',
              PT: 'documentario historia curiosidades',
              US: 'documentary history explained',
              FR: 'documentaire histoire mystere',
              ES: 'documental historia curiosidades',
            },
            '28': {
              BR: 'ciencia tecnologia inteligencia artificial',
              PT: 'ciencia tecnologia futuro',
              US: 'science technology breakthrough',
              FR: 'science technologie decouverte',
              ES: 'ciencia tecnologia descubrimiento',
            },
            '24': {
              BR: 'misterios fatos reais entretenimento',
              PT: 'misterios historias reais',
              US: 'viral storytelling documentary',
              FR: 'histoires incroyables documentaire',
              ES: 'historias increibles documental',
            },
            '22': {
              BR: 'psicologia comportamento humano',
              PT: 'psicologia comportamento humano',
              US: 'psychology human behavior',
              FR: 'psychologie comportement humain',
              ES: 'psicologia comportamiento humano',
            },
            '25': {
              BR: 'geopolitica mundo noticias analise',
              PT: 'geopolitica mundo analise',
              US: 'geopolitics world news analysis',
              FR: 'geopolitique actualite analyse',
              ES: 'geopolitica mundo analisis',
            },
          };

          if (catQueries[cat]) {
            const q = catQueries[cat][gl] || catQueries[cat].US;
            const items = await scrapePublicYouTubeSearch(q, gl, hl);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ items }));
            return;
          }

          // Scrape official public YouTube Trending feed (/feed/trending)
          const trendRes = await fetch(
            `https://www.youtube.com/feed/trending?gl=${encodeURIComponent(
              gl
            )}&hl=${encodeURIComponent(hl)}`,
            {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept-Language': `${hl},en-US;q=0.8,en;q=0.7`,
                Cookie:
                  'SOCS=CAISHAgBEhJnd3NfMjAyMzA4MTAtMF9SQzIaAmVuIAEaBgiAo_CmBg; CONSENT=YES+cb',
              },
            }
          );

          if (trendRes.ok) {
            const html = await trendRes.text();
            const marker = 'var ytInitialData = ';
            const idx = html.indexOf(marker);
            if (idx !== -1) {
              const after = html.slice(idx + marker.length);
              let end = after.indexOf(';</script>');
              if (end === -1) end = after.indexOf('</script>');
              const jsonRaw = end !== -1 ? after.slice(0, end).trim().replace(/;$/, '') : '{}';
              let data: unknown = {};
              try {
                data = JSON.parse(jsonRaw);
              } catch {
                data = {};
              }
              const renderers: any[] = [];
              const walk = (n: unknown) => {
                if (!n || typeof n !== 'object') return;
                if (Array.isArray(n)) {
                  for (const x of n) walk(x);
                  return;
                }
                const o = n as Record<string, unknown>;
                if (o.videoRenderer && typeof o.videoRenderer === 'object') {
                  renderers.push(o.videoRenderer);
                  return;
                }
                for (const v of Object.values(o)) {
                  if (renderers.length < 32) walk(v);
                }
              };
              walk(data);

              if (renderers.length > 0) {
                const items = renderers
                  .slice(0, 28)
                  .map((vr: any) => {
                    const videoId = String(vr.videoId || '');
                    const title =
                      vr.title?.runs?.map((r: any) => r.text).join('') ||
                      vr.title?.simpleText ||
                      'Vídeo';
                    const chRun = vr.ownerText?.runs?.[0] || vr.longBylineText?.runs?.[0];
                    const channelTitle = chRun?.text || 'Canal';
                    const browseId = chRun?.navigationEndpoint?.browseEndpoint?.browseId || '';
                    const viewRaw =
                      vr.viewCountText?.simpleText ||
                      vr.viewCountText?.runs?.map((r: any) => r.text).join('') ||
                      '0';
                    const lower = viewRaw.toLowerCase();
                    let mult = 1;
                    if (/\bmi\b|\bm\b|million|milh/i.test(lower)) mult = 1_000_000;
                    else if (/\bk\b|\bmil\b/i.test(lower)) mult = 1_000;
                    const views =
                      mult > 1
                        ? Math.round(
                            parseFloat(
                              (lower.match(/(\d+(?:[.,]\d+)?)/)?.[1] || '0').replace(',', '.')
                            ) * mult
                          )
                        : parseInt(lower.replace(/[^\d]/g, '') || '0', 10);

                    const lenTxt = vr.lengthText?.simpleText || '';
                    const parts = lenTxt.split(':').map((p: string) => parseInt(p.trim(), 10) || 0);
                    const durationSec =
                      parts.length === 3
                        ? parts[0] * 3600 + parts[1] * 60 + parts[2]
                        : parts.length === 2
                        ? parts[0] * 60 + parts[1]
                        : 180;
                    const pubTxt = (vr.publishedTimeText?.simpleText || '').toLowerCase();
                    const num = parseInt(pubTxt.match(/(\d+)/)?.[1] || '12', 10);
                    const hoursAgo = /hour|hora|heure/i.test(pubTxt)
                      ? Math.max(1, num)
                      : /day|dia|jour|d\u00eda/i.test(pubTxt)
                      ? num * 24
                      : 24;
                    const thumbs = vr.thumbnail?.thumbnails || [];
                    return {
                      id: videoId,
                      title,
                      channelId: browseId,
                      channelTitle,
                      publishedAt: new Date(Date.now() - hoursAgo * 3600000)
                        .toISOString()
                        .slice(0, 10),
                      daysAgo: Math.max(1, Math.round(hoursAgo / 24)),
                      hoursAgo,
                      thumbnailUrl:
                        thumbs[thumbs.length - 1]?.url ||
                        `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
                      durationSec,
                      isShort: durationSec <= 65,
                      views,
                    };
                  })
                  .filter((i) => Boolean(i.id) && i.views > 0);

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ items }));
                return;
              }
            }
          }

          const fallbackItems = await scrapePublicYouTubeSearch(
            gl === 'US' ? 'viral documentary today' : 'documentario em alta hoje',
            gl,
            hl
          );
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ items: fallbackItems }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : 'Erro ao buscar vídeos em alta',
            })
          );
        }
      });

      server.middlewares.use('/api/send-email', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Método não permitido' }));
          return;
        }
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          let body: {
            smtp?: {
              host: string;
              port: number;
              secure: boolean;
              user: string;
              pass: string;
            };
            to: string;
            subject: string;
            text: string;
            pdfBase64?: string;
            filename?: string;
          };
          try {
            body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          } catch {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Payload JSON inválido.' }));
            return;
          }

          if (!body.smtp?.host || !body.smtp?.user || !body.smtp?.pass || !body.to) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                error: 'Configure o servidor SMTP (Host, Usuário e Senha de App) antes de enviar.',
              })
            );
            return;
          }

          const transporter = nodemailer.createTransport({
            host: body.smtp.host,
            port: Number(body.smtp.port) || 587,
            secure: Boolean(body.smtp.secure),
            auth: {
              user: body.smtp.user,
              pass: body.smtp.pass,
            },
          });

          const info = await transporter.sendMail({
            from: `"Open Analytic YT" <${body.smtp.user}>`,
            to: body.to,
            subject: body.subject,
            text: body.text,
            attachments:
              body.pdfBase64 && body.filename
                ? [
                    {
                      filename: body.filename,
                      content: Buffer.from(body.pdfBase64, 'base64'),
                      contentType: 'application/pdf',
                    },
                  ]
                : [],
          });

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, messageId: info.messageId }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : 'Erro ao enviar e-mail SMTP',
            })
          );
        }
      });

      server.middlewares.use('/api/ai-analyze', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          let body: {
            provider: 'gemini' | 'openai' | 'deepseek' | 'groq' | 'openrouter' | 'nvidia';
            apiKey: string;
            model?: string;
            prompt: string;
          };
          try {
            body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          } catch {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Payload JSON inválido.' }));
            return;
          }

          if (!body.apiKey) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'API key missing' }));
            return;
          }

          if (body.provider === 'gemini') {
            const defaultGeminiModels = [
              'gemini-2.5-flash',
              'gemini-2.0-flash',
              'gemini-1.5-flash',
            ];
            const models = body.model?.trim()
              ? [body.model.trim(), ...defaultGeminiModels.filter((m) => m !== body.model?.trim())]
              : defaultGeminiModels;
            let lastError = 'Gemini request failed';

            for (const model of models) {
              const apiRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
                  body.apiKey
                )}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contents: [{ parts: [{ text: body.prompt }] }],
                  }),
                }
              );
              const data = (await apiRes.json()) as {
                candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
                error?: { message?: string };
              };
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (apiRes.ok && text) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: true, text, model }));
                return;
              }
              lastError = data.error?.message || `HTTP ${apiRes.status}`;
            }

            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: lastError }));
            return;
          }

          // OpenAI-compatible providers: OpenAI, DeepSeek, Groq, OpenRouter, NVIDIA NIM
          const providerEndpoints: Record<
            'openai' | 'deepseek' | 'groq' | 'openrouter' | 'nvidia',
            { url: string; defaultModel: string }
          > = {
            openai: {
              url: 'https://api.openai.com/v1/chat/completions',
              defaultModel: 'gpt-4o-mini',
            },
            deepseek: {
              url: 'https://api.deepseek.com/chat/completions',
              defaultModel: 'deepseek-chat',
            },
            groq: {
              url: 'https://api.groq.com/openai/v1/chat/completions',
              defaultModel: 'llama-3.3-70b-versatile',
            },
            openrouter: {
              url: 'https://openrouter.ai/api/v1/chat/completions',
              defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
            },
            nvidia: {
              url: 'https://integrate.api.nvidia.com/v1/chat/completions',
              defaultModel: 'meta/llama-3.3-70b-instruct',
            },
          };

          const cfg = providerEndpoints[body.provider];
          const chosenModel = body.model?.trim() || cfg.defaultModel;

          const oaRes = await fetch(cfg.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${body.apiKey}`,
              ...(body.provider === 'openrouter'
                ? {
                    'HTTP-Referer': 'http://localhost:5173',
                    'X-Title': 'Open Analytic YT',
                  }
                : {}),
            },
            body: JSON.stringify({
              model: chosenModel,
              messages: [{ role: 'user', content: body.prompt }],
            }),
          });
          const oaRaw = await oaRes.text();
          let oaData: {
            choices?: Array<{ message?: { content?: string } }>;
            error?: { message?: string };
            detail?: string;
          } = {};
          try {
            oaData = JSON.parse(oaRaw);
          } catch {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                error: `${body.provider} retornou resposta inválida (${oaRes.status}): ${oaRaw.slice(
                  0,
                  140
                )}`,
              })
            );
            return;
          }
          const oaText = oaData.choices?.[0]?.message?.content;
          if (!oaRes.ok || !oaText) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                error:
                  oaData.error?.message ||
                  oaData.detail ||
                  `${body.provider} HTTP ${oaRes.status}`,
              })
            );
            return;
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, text: oaText, model: chosenModel }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : 'AI proxy error',
            })
          );
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), youtubePublicProxyPlugin()],
});
