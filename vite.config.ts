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
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), youtubePublicProxyPlugin()],
});
