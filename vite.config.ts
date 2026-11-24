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
          const ytUrl = isChannelId
            ? `https://www.youtube.com/channel/${encodeURIComponent(target)}`
            : `https://www.youtube.com/${target.startsWith('@') ? target : `@${target}`}`;

          const pageRes = await fetch(ytUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept-Language': 'en-US,en;q=0.9',
            },
          });

          if (!pageRes.ok) {
            res.statusCode = pageRes.status;
            res.end(JSON.stringify({ error: `YouTube retornou HTTP ${pageRes.status}` }));
            return;
          }

          const html = await pageRes.text();

          const channelIdMatch =
            html.match(/"externalId":"(UC[\w-]{20,})"/) ||
            html.match(/channel_id=(UC[\w-]{20,})/);
          const titleMatch =
            html.match(/<meta property="og:title" content="([^"]+)"/) ||
            html.match(/"title":"([^"]+)"/);
          const avatarMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
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
              )}`
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

      const scrapePublicYouTubeSearch = async (q: string, gl: string, hl: string) => {
        const ytSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
          q
        )}&gl=${encodeURIComponent(gl)}&hl=${encodeURIComponent(hl)}`;

        const pageRes = await fetch(ytSearchUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': `${hl},en-US;q=0.8,en;q=0.7`,
          },
        });

        if (!pageRes.ok) {
          throw new Error(`YouTube search HTTP ${pageRes.status}`);
        }

        const html = await pageRes.text();
        const marker = 'var ytInitialData = ';
        const startIdx = html.indexOf(marker);
        if (startIdx === -1) return [];

        const afterMarker = html.slice(startIdx + marker.length);
        const endIdx = afterMarker.indexOf(';</script>');
        const jsonStr = endIdx !== -1 ? afterMarker.slice(0, endIdx) : '';
        const initialData = JSON.parse(jsonStr);

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
          if (/\bmi|\bm\b|million|milh/i.test(clean)) mult = 1_000_000;
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

        return renderers
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
            const isShortOverlay = JSON.stringify(vr.thumbnailOverlays || []).includes('SHORTS');
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
          .filter((item) => Boolean(item.id));
      };

      const radarMemoryCache = new Map<
        string,
        { savedAt: number; scannedAt: string; trends: unknown[] }
      >();

      const AUTO_NICHE_SEEDS = [
        {
          id: 'biblical-arch',
          icon: '🏺',
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
          id: 'dark-psych',
          icon: '🧠',
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
          id: 'ancient-civ',
          icon: '🏛️',
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
          id: 'unsolved-mysteries',
          icon: '🕵️',
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
          names: {
            BR: 'Universo, Espaço & Astronomia',
            US: 'Space, Cosmos & James Webb',
            FR: 'Univers, Espace & Astronomie',
            ES: 'Universo, Espacio & Astronomía',
          },
          queries: {
            BR: 'universo espaco descoberta james webb astronomia',
            US: 'james webb space discovery universe documentary',
            FR: 'univers espace decouverte astronomie',
            ES: 'universo espacio descubrimiento astronomia',
          },
        },
        {
          id: 'ai-future',
          icon: '🤖',
          names: {
            BR: 'IA, Robótica & Futuro',
            US: 'AI Breakthroughs & Future Tech',
            FR: 'IA, Robotique & Futur',
            ES: 'IA, Robótica & Futuro',
          },
          queries: {
            BR: 'inteligencia artificial futuro tecnologia revolucao',
            US: 'ai breakthrough future technology agents',
            FR: 'intelligence artificielle futur technologie',
            ES: 'inteligencia artificial futuro tecnologia',
          },
        },
        {
          id: 'geopolitics-econ',
          icon: '🌍',
          names: {
            BR: 'Geopolítica & Economia Global',
            US: 'Geopolitics & Global Economy',
            FR: 'Géopolitique & Économie Mondiale',
            ES: 'Geopolítica & Economía Global',
          },
          queries: {
            BR: 'geopolitica economia global crise imperios',
            US: 'geopolitics global economy documentary',
            FR: 'geopolitique economie mondiale analyse',
            ES: 'geopolitica economia mundial documental',
          },
        },
        {
          id: 'neuro-longevity',
          icon: '🧬',
          names: {
            BR: 'Neurociência, Corpo & Longevidade',
            US: 'Neuroscience, Brain & Longevity',
            FR: 'Neurosciences, Cerveau & Santé',
            ES: 'Neurociencia, Cerebro & Longevidad',
          },
          queries: {
            BR: 'neurociencia cerebro dopamina ciencia corpo humano',
            US: 'neuroscience brain dopamine longevity science',
            FR: 'neurosciences cerveau dopamine science',
            ES: 'neurociencia cerebro dopamina ciencia',
          },
        },
      ] as const;

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

          const trends = await Promise.all(
            AUTO_NICHE_SEEDS.map(async (seed) => {
              const q = seed.queries[market];
              try {
                const allItems = await scrapePublicYouTubeSearch(q, market, hlMap[market]);
                const recent = allItems.filter((v) => v.daysAgo <= 60 && v.views > 0);
                const pool = recent.length >= 3 ? recent : allItems.filter((v) => v.views > 0);

                if (pool.length === 0) {
                  return {
                    id: seed.id,
                    name: seed.names[market],
                    icon: seed.icon,
                    query: q,
                    market,
                    heatScore: 25,
                    statusLabel: 'Estável',
                    avgViewsPerDay: 0,
                    maxOutlier: 1,
                    recentCount: 0,
                    shortsPct: 0,
                    topVideo: null,
                  };
                }

                const sortedViews = [...pool.map((i) => i.views)].sort((a, b) => a - b);
                const medianViews = Math.max(
                  sortedViews[Math.floor(sortedViews.length / 2)] || 1500,
                  250
                );

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
                    b.viewsPerDay * Math.min(b.outlierScore, 6) -
                    a.viewsPerDay * Math.min(a.outlierScore, 6)
                );
                const best = sortedByVelocity[0];
                const maxOutlier = Number(
                  Math.max(...enriched.map((e) => e.outlierScore), 1).toFixed(1)
                );
                const breakoutsCount = enriched.filter(
                  (e) => e.daysAgo <= 30 && e.outlierScore >= 1.6
                ).length;
                const shortsPct = Math.round(
                  (enriched.filter((e) => e.isShort).length / enriched.length) * 100
                );

                const velScore = Math.min(
                  48,
                  Math.round(Math.log10(Math.max(avgViewsPerDay, 20)) * 10.5)
                );
                const outScore = Math.min(32, Math.round(maxOutlier * 4.2));
                const freshScore = Math.min(19, breakoutsCount * 4);
                const heatScore = Math.max(
                  30,
                  Math.min(99, velScore + outScore + freshScore)
                );

                const statusLabel =
                  heatScore >= 82
                    ? 'Explodindo Agora'
                    : heatScore >= 68
                    ? 'Em Forte Alta'
                    : heatScore >= 52
                    ? 'Acelerando'
                    : 'Aquecendo';

                return {
                  id: seed.id,
                  name: seed.names[market],
                  icon: seed.icon,
                  query: q,
                  market,
                  heatScore,
                  statusLabel,
                  avgViewsPerDay,
                  maxOutlier,
                  recentCount: enriched.filter((e) => e.daysAgo <= 30).length,
                  shortsPct,
                  topVideo: best
                    ? {
                        id: best.id,
                        title: best.title,
                        channelTitle: best.channelTitle,
                        thumbnailUrl: best.thumbnailUrl,
                        views: best.views,
                        viewsPerDay: best.viewsPerDay,
                        daysAgo: best.daysAgo,
                        outlierScore: best.outlierScore,
                        isShort: best.isShort,
                      }
                    : null,
                };
              } catch {
                return {
                  id: seed.id,
                  name: seed.names[market],
                  icon: seed.icon,
                  query: q,
                  market,
                  heatScore: 20,
                  statusLabel: 'Aguardando',
                  avgViewsPerDay: 0,
                  maxOutlier: 1,
                  recentCount: 0,
                  shortsPct: 0,
                  topVideo: null,
                };
              }
            })
          );

          const ranked = trends.sort(
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
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
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
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
            provider: 'gemini' | 'openai' | 'deepseek' | 'groq' | 'openrouter' | 'nvidia';
            apiKey: string;
            model?: string;
            prompt: string;
          };

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
