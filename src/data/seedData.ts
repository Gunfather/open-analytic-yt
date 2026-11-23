import { Channel, DailyMetric, Language, VideoItem } from '../types/youtube';

export const INITIAL_LANGUAGES: Language[] = [
  { id: 'pt-BR', code: 'PT-BR', name: 'Brasileiro', flag: '🇧🇷', color: '#22c55e' },
  { id: 'en', code: 'EN', name: 'Inglês', flag: '🇺🇸', color: '#3b82f6' },
  { id: 'fr', code: 'FR', name: 'Francês', flag: '🇫🇷', color: '#a855f7' },
  { id: 'es', code: 'ES', name: 'Espanhol', flag: '🇪🇸', color: '#eab308' },
];

export const INITIAL_CHANNELS: Channel[] = [
  {
    id: 'ch-br-1',
    handle: '@CuriosidadesBR',
    name: 'Curiosidades BR',
    languageId: 'pt-BR',
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=CB&backgroundColor=16a34a',
    color: '#22c55e',
    isActive: true,
    subscribersTotal: 184200,
    viewsTotal: 14250000,
    videosTotal: 214,
    rpm: 1.85,
    cpm: 3.4,
    hookRate: 62.4,
    engagedRate: 54.1,
    lastSyncedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  },
  {
    id: 'ch-br-2',
    handle: '@FinancasPulseBR',
    name: 'Finanças Pulse BR',
    languageId: 'pt-BR',
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=FP&backgroundColor=15803d',
    color: '#4ade80',
    isActive: true,
    subscribersTotal: 92400,
    viewsTotal: 6180000,
    videosTotal: 142,
    rpm: 4.9,
    cpm: 8.6,
    hookRate: 58.1,
    engagedRate: 49.3,
    lastSyncedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  },
  {
    id: 'ch-en-1',
    handle: '@ThePurringRiddler',
    name: 'The Purring Riddler',
    languageId: 'en',
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=PR&backgroundColor=2563eb',
    color: '#3b82f6',
    isActive: true,
    subscribersTotal: 312000,
    viewsTotal: 28900000,
    videosTotal: 318,
    rpm: 3.65,
    cpm: 6.8,
    hookRate: 68.7,
    engagedRate: 57.8,
    lastSyncedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  },
  {
    id: 'ch-en-2',
    handle: '@DeepMindStoriesEN',
    name: 'DeepMind Stories',
    languageId: 'en',
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=DM&backgroundColor=1d4ed8',
    color: '#60a5fa',
    isActive: true,
    subscribersTotal: 145800,
    viewsTotal: 11400000,
    videosTotal: 176,
    rpm: 4.15,
    cpm: 7.45,
    hookRate: 61.2,
    engagedRate: 52.4,
    lastSyncedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  },
  {
    id: 'ch-fr-1',
    handle: '@EnigmesFR',
    name: 'Énigmes & Mystères',
    languageId: 'fr',
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=EM&backgroundColor=9333ea',
    color: '#a855f7',
    isActive: true,
    subscribersTotal: 118500,
    viewsTotal: 8950000,
    videosTotal: 195,
    rpm: 2.95,
    cpm: 5.2,
    hookRate: 64.0,
    engagedRate: 53.6,
    lastSyncedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  },
  {
    id: 'ch-fr-2',
    handle: '@HistoiresChronoFR',
    name: 'Histoires Chrono FR',
    languageId: 'fr',
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=HC&backgroundColor=7e22ce',
    color: '#c084fc',
    isActive: true,
    subscribersTotal: 67300,
    viewsTotal: 4210000,
    videosTotal: 112,
    rpm: 2.6,
    cpm: 4.8,
    hookRate: 56.5,
    engagedRate: 48.2,
    lastSyncedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  },
  {
    id: 'ch-es-1',
    handle: '@AcertijosHoyES',
    name: 'Acertijos Hoy',
    languageId: 'es',
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=AH&backgroundColor=ca8a04',
    color: '#eab308',
    isActive: true,
    subscribersTotal: 229400,
    viewsTotal: 19700000,
    videosTotal: 268,
    rpm: 1.65,
    cpm: 3.1,
    hookRate: 65.8,
    engagedRate: 55.9,
    lastSyncedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  },
  {
    id: 'ch-es-2',
    handle: '@MenteGlobalES',
    name: 'Mente Global ES',
    languageId: 'es',
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=MG&backgroundColor=a16207',
    color: '#facc15',
    isActive: true,
    subscribersTotal: 88900,
    viewsTotal: 5430000,
    videosTotal: 134,
    rpm: 1.9,
    cpm: 3.55,
    hookRate: 59.3,
    engagedRate: 50.1,
    lastSyncedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  },
];

// Deterministic pseudo-random helper so demo data stays consistent across reloads
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const VIDEO_TITLES_BY_LANG: Record<string, string[]> = {
  'pt-BR': [
    'O Mistério Que Ninguém Conseguiu Explicar #shorts',
    '7 Segredos Que Mudam Sua Visão Hoje',
    'Você Consegue Resolver em 10 Segundos?',
    'A Verdade Oculta Por Trás Disso',
    'Como Esse Padrão Funciona na Prática',
    'Teste Rápido: Apenas 2% Acertam #shorts',
  ],
  en: [
    'Riddle #33 - Looks Easy... But It\'s Not! #shorts',
    'Why 97% of People Miss This Detail',
    'The Hidden Pattern Nobody Talks About',
    'Can You Spot The Difference in 8 Seconds? #shorts',
    'How One Small Shift Changed Everything',
    'Brain Teaser #41 - Extreme Mode #shorts',
  ],
  fr: [
    'Énigme #28 - Plus Difficile Qu\'il N\'y Paraît #shorts',
    'Le Secret Que Personne Ne Remarque',
    'Pouvez-vous Trouver la Réponse en 10s ? #shorts',
    'L\'Histoire Incroyable Derrière Ce Phénomène',
    '3 Indices Qui Révèlent Tout',
    'Test Logique : Seulement 4% Réussissent',
  ],
  es: [
    'Acertijo #45 - Parece Fácil Pero No Lo Es #shorts',
    'El Detalle Oculto Que Casi Nadie Ve',
    '¿Puedes Resolverlo Antes Que Termine? #shorts',
    'La Historia Real Detrás de Este Caso',
    '5 Claves Para Entender Este Fenómeno',
    'Reto Mental: Solo el 3% Lo Logra #shorts',
  ],
};

function formatDateISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function generateSeedMetricsAndVideos(
  channels: Channel[],
  days = 90
): { metrics: DailyMetric[]; videos: VideoItem[] } {
  const metrics: DailyMetric[] = [];
  const videos: VideoItem[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  channels.forEach((channel, chIdx) => {
    const baseDailyViews = Math.max(450, Math.round(channel.viewsTotal / 1800));
    const titles = VIDEO_TITLES_BY_LANG[channel.languageId] ?? VIDEO_TITLES_BY_LANG.en;

    for (let d = days - 1; d >= 0; d--) {
      const dateObj = new Date(today);
      dateObj.setDate(today.getDate() - d);
      const dateStr = formatDateISO(dateObj);

      const seed = (chIdx + 1) * 1000 + d;
      const wave = Math.sin(d * 0.35 + chIdx) * 0.35 + 1;
      const noise = 0.65 + seededRandom(seed) * 0.85;
      // Occasional viral spike
      const spike = seededRandom(seed + 77) > 0.91 ? 1.8 + seededRandom(seed + 13) * 1.4 : 1;

      const views = Math.round(baseDailyViews * wave * noise * spike);
      const engagedViews = Math.round(views * (channel.engagedRate / 100));
      const watchTimeHours = Number(((views * (1.8 + seededRandom(seed + 3) * 2.4)) / 60).toFixed(1));
      const subscribersGained = Math.max(
        0,
        Math.round((views / 420) * (0.6 + seededRandom(seed + 9) * 0.9))
      );
      const likes = Math.round(views * (0.032 + seededRandom(seed + 19) * 0.025));
      const comments = Math.round(views * (0.004 + seededRandom(seed + 23) * 0.005));
      const shares = Math.round(views * (0.003 + seededRandom(seed + 29) * 0.004));
      const revenue = Number(((views / 1000) * channel.rpm).toFixed(2));

      metrics.push({
        date: dateStr,
        channelId: channel.id,
        views,
        engagedViews,
        watchTimeHours,
        subscribersGained,
        likes,
        comments,
        shares,
        revenue,
      });

      // Publish a video roughly every 3-4 days per channel
      if ((d + chIdx * 2) % 4 === 0 && d < 60) {
        const title = titles[(d + chIdx) % titles.length];
        const isShort = title.includes('#shorts');
        const vidViews = Math.round(views * (1.1 + seededRandom(seed + 51) * 1.5));
        const vidEngaged = Math.round(vidViews * (channel.engagedRate / 100));
        videos.push({
          id: `vid-${channel.id}-${dateStr}`,
          channelId: channel.id,
          title,
          publishedAt: dateStr,
          thumbnailUrl: `https://picsum.photos/seed/${channel.id}-${d}/320/180`,
          durationSec: isShort ? 42 + Math.round(seededRandom(seed + 5) * 16) : 420 + Math.round(seededRandom(seed + 5) * 480),
          isShort,
          views: vidViews,
          engagedViews: vidEngaged,
          watchTimeHours: Number(((vidViews * (isShort ? 0.65 : 4.2)) / 60).toFixed(1)),
          likes: Math.round(vidViews * 0.045),
          comments: Math.round(vidViews * 0.007),
          shares: Math.round(vidViews * 0.005),
          revenue: Number(((vidViews / 1000) * channel.rpm).toFixed(2)),
          hookRate: Number((channel.hookRate + (seededRandom(seed + 61) - 0.5) * 8).toFixed(1)),
          ctr: Number((5.2 + seededRandom(seed + 67) * 5.8).toFixed(1)),
        });
      }
    }
  });

  return { metrics, videos };
}

const DECAY_WEIGHTS = [0.45, 0.25, 0.15, 0.1, 0.05];

export function buildDailyMetricsFromVideos(
  channel: Channel,
  channelVideos: VideoItem[],
  days = 90
): DailyMetric[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayMap = new Map<string, DailyMetric>();
  for (let d = days - 1; d >= 0; d--) {
    const dateObj = new Date(today);
    dateObj.setDate(today.getDate() - d);
    const dateStr = formatDateISO(dateObj);
    dayMap.set(dateStr, {
      date: dateStr,
      channelId: channel.id,
      views: 0,
      engagedViews: 0,
      watchTimeHours: 0,
      subscribersGained: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      revenue: 0,
    });
  }

  for (const v of channelVideos) {
    const pubDate = new Date(`${v.publishedAt}T00:00:00`);
    if (Number.isNaN(pubDate.getTime())) continue;

    DECAY_WEIGHTS.forEach((w, offset) => {
      const targetDate = new Date(pubDate);
      targetDate.setDate(pubDate.getDate() + offset);
      const dateStr = formatDateISO(targetDate);
      const bucket = dayMap.get(dateStr);
      if (!bucket) return;

      const viewsPart = Math.round(v.views * w);
      bucket.views += viewsPart;
      bucket.engagedViews += Math.round(v.engagedViews * w);
      bucket.watchTimeHours = Number((bucket.watchTimeHours + v.watchTimeHours * w).toFixed(1));
      bucket.likes += Math.round(v.likes * w);
      bucket.comments += Math.round(v.comments * w);
      bucket.shares += Math.round(v.shares * w);
      bucket.revenue = Number((bucket.revenue + v.revenue * w).toFixed(2));
      bucket.subscribersGained += Math.round((viewsPart / 350) * 1);
    });
  }

  return Array.from(dayMap.values());
}
