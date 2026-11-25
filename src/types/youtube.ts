export type PeriodOption = '24h' | '48h' | '7d' | '14d' | '30d' | '90d';

export type NavTab =
  | 'dashboard'
  | 'radar'
  | 'trending'
  | 'channels'
  | 'videos'
  | 'analytics'
  | 'niche'
  | 'scheduled'
  | 'settings';

export type ChartViewMode = 'combined' | 'individual' | 'by_language' | 'by_group';

export type KpiMetricKey = 'views' | 'watchTime' | 'subscribers' | 'engagement' | 'revenue';

export interface Language {
  id: string;
  code: string;
  name: string;
  flag: string;
  color: string;
}

export interface ChannelGroup {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface ChannelNiche {
  id: string;
  name: string;
  keywords?: string;
  icon: string;
  color: string;
}

export interface TrafficSources {
  search: number; // Pesquisa do YouTube (%)
  browse: number; // Funcionalidades de navegação (%)
  suggested: number; // Vídeos sugeridos (%)
  shorts: number; // Feed dos Shorts (%)
  other: number; // Externo / Outros (%)
}

export interface DemographicGroup {
  gender: string; // Ex: Masculino, Feminino, Misto
  ageRange: string; // Ex: Mais de 65 anos, 25-34 anos
}

export interface ViewerBehavior {
  newViewers: number; // Novos visitantes (%)
  casualViewers: number; // Visitantes ocasionais (%)
  returningViewers: number; // Visitantes habituais (%)
}

export interface DeviceTypes {
  mobile: number; // Telemóvel (%)
  desktop: number; // Computador (%)
  tv: number; // TV (%)
  tablet: number; // Tablet (%)
}

export interface GeographyEntry {
  country: string;
  pct: number;
}

export interface AgeBreakdown {
  a13_17: number;
  a18_24: number;
  a25_34: number;
  a35_44: number;
  a45_54: number;
  a55_64: number;
  a65plus: number;
}

export interface GenderBreakdown {
  female: number;
  male: number;
  custom: number;
}

export interface Channel {
  id: string;
  youtubeChannelId?: string;
  handle: string;
  name: string;
  languageId: string;
  groupId?: string;
  nicheId?: string;
  avatarUrl: string;
  color: string;
  isActive: boolean;
  subscribersTotal: number;
  viewsTotal: number;
  videosTotal: number;
  rpm: number;
  cpm: number;
  hookRate: number;
  engagedRate: number;
  ctr?: number;
  trafficSources?: TrafficSources;
  demographic?: DemographicGroup;
  viewerBehavior?: ViewerBehavior;
  deviceTypes?: DeviceTypes;
  geographies?: GeographyEntry[];
  ageBreakdown?: AgeBreakdown;
  genderBreakdown?: GenderBreakdown;
  lastSyncedAt: string;
  isLiveApi?: boolean;
}

export interface DailyMetric {
  date: string; // YYYY-MM-DD
  channelId: string;
  views: number;
  engagedViews: number;
  watchTimeHours: number;
  subscribersGained: number;
  likes: number;
  comments: number;
  shares: number;
  revenue: number;
}

export interface VideoItem {
  id: string;
  channelId: string;
  title: string;
  publishedAt: string; // YYYY-MM-DD
  thumbnailUrl: string;
  durationSec: number;
  isShort: boolean;
  views: number;
  engagedViews: number;
  watchTimeHours: number;
  likes: number;
  comments: number;
  shares: number;
  revenue: number;
  hookRate: number;
  ctr: number;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'once';

export interface ScheduledTaskSections {
  kpis: boolean;
  byLanguage: boolean;
  byChannel: boolean;
  topVideos: boolean;
  topEngagement: boolean;
  audienceDetails: boolean;
}

export interface ScheduledTask {
  id: string;
  name: string;
  toEmail: string;
  frequency: ScheduleFrequency;
  time: string; // HH:MM
  weekday?: number; // 0 (Dom) - 6 (Sab)
  monthDay?: number; // 1 - 28
  onceDate?: string; // YYYY-MM-DD
  period: PeriodOption;
  languageId: string;
  groupId: string;
  channelId: string;
  topVideosLimit: number;
  sections: ScheduledTaskSections;
  aiNote?: string;
  isActive: boolean;
  lastRunAt?: string;
  lastRunKey?: string; // YYYY-MM-DD HH:MM to prevent duplicate runs in same minute
  lastStatus?: string;
}

export interface AggregatedKpis {
  views: number;
  viewsDelta: number;
  viewsDeltaPct: number;
  engagedViews: number;
  hookRate: number;
  watchTimeHours: number;
  watchTimeDeltaPct: number;
  subscribers: number;
  subscribersDeltaPct: number;
  engagement: number;
  engagementDeltaPct: number;
  likes: number;
  comments: number;
  shares: number;
  revenue: number;
  revenueDeltaPct: number;
  avgCpm: number;
  avgRpm: number;
}

export interface NicheVideoItem {
  id: string;
  title: string;
  channelId: string;
  channelTitle: string;
  channelHandle?: string;
  channelSubs: number;
  publishedAt: string; // YYYY-MM-DD
  daysAgo: number;
  thumbnailUrl: string;
  durationSec: number;
  isShort: boolean;
  views: number;
  likes: number;
  comments: number;
  viewsPerDay: number;
  outlierScore: number;
  engagementRate: number;
}

export interface CompetitorVideo {
  id: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string;
  durationSec: number;
  isShort: boolean;
  views: number;
  likes: number;
  comments: number;
  outlierScore: number;
  viewsPerDay: number;
}

export interface CompetitorChannel {
  id: string;
  youtubeChannelId?: string;
  handle: string;
  name: string;
  nicheTag: string;
  languageId: string;
  avatarUrl: string;
  subscribersTotal: number;
  viewsTotal: number;
  videosTotal: number;
  avgViewsRecent: number;
  videos: CompetitorVideo[];
  lastSyncedAt: string;
}

export interface AutoNicheVideoSample {
  id: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  views: number;
  viewsPerDay: number;
  daysAgo: number;
  outlierScore: number;
  isShort: boolean;
}

export interface AutoNicheTrend {
  id: string;
  name: string;
  icon: string;
  query: string;
  market: 'BR' | 'US' | 'FR' | 'ES';
  heatScore: number;
  statusLabel: string;
  avgViewsPerDay: number;
  maxOutlier: number;
  recentCount: number;
  shortsPct: number;
  estimatedRpm: number;
  competitionLevel: 'Baixa' | 'Média' | 'Alta';
  uniqueChannelsPct: number;
  isEmergentDiscovery?: boolean;
  usArbitrageGap?: number; // >1.5 means exploding harder in US than locally (wave incoming!)
  risingKeywords: string[];
  topVideo: AutoNicheVideoSample | null;
  topVideos: AutoNicheVideoSample[];
}

export interface TrendingYouTubeVideo {
  id: string;
  title: string;
  channelId: string;
  channelTitle: string;
  channelHandle?: string;
  channelSubs: number;
  categoryId: string;
  publishedAt: string;
  hoursAgo: number;
  thumbnailUrl: string;
  durationSec: number;
  isShort: boolean;
  views: number;
  likes: number;
  comments: number;
  viewsPerHour: number;
  outlierScore: number;
  engagementRate: number;
}
