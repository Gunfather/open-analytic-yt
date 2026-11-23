import { useMemo, useState } from 'react';
import { ExternalLink, Eye, MessageSquare, PlaySquare, RefreshCw, Search, ThumbsUp } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import {
  formatCompact,
  formatCurrency,
  formatDuration,
  formatNumber,
} from '../utils/formatters';

export function VideosView() {
  const { filteredChannels, languages, videos, isSyncing, syncAllChannels, t } = useStore();
  const [search, setSearch] = useState('');
  const [formatFilter, setFormatFilter] = useState<'all' | 'shorts' | 'long'>('all');
  const [sortBy, setSortBy] = useState<'publishedAt' | 'views' | 'comments' | 'revenue'>('publishedAt');

  const channelMap = useMemo(
    () => new Map(filteredChannels.map((c) => [c.id, c])),
    [filteredChannels]
  );
  const langMap = useMemo(
    () => new Map(languages.map((l) => [l.id, l])),
    [languages]
  );

  const filteredVideos = useMemo(() => {
    return videos
      .filter((v) => {
        if (!channelMap.has(v.channelId)) return false;
        if (formatFilter === 'shorts' && !v.isShort) return false;
        if (formatFilter === 'long' && v.isShort) return false;
        if (search && !v.title.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'views') return b.views - a.views;
        if (sortBy === 'comments') return b.comments - a.comments;
        if (sortBy === 'revenue') return b.revenue - a.revenue;
        return b.publishedAt.localeCompare(a.publishedAt);
      });
  }, [videos, channelMap, formatFilter, search, sortBy]);

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <PlaySquare className="w-5 h-5 text-orange-400" />
          {t('tabVideos')} ({filteredVideos.length})
        </h2>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t('searchTitle')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 rounded-xl bg-[#121720] border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500"
            />
          </div>

          <select
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value as 'all' | 'shorts' | 'long')}
            className="px-3 py-1.5 rounded-xl bg-[#121720] border border-slate-800 text-xs text-white focus:outline-none cursor-pointer"
          >
            <option value="all">{t('allFormats')}</option>
            <option value="shorts">{t('shortsOnly')}</option>
            <option value="long">{t('longVideos')}</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'publishedAt' | 'views' | 'comments' | 'revenue')}
            className="px-3 py-1.5 rounded-xl bg-[#121720] border border-slate-800 text-xs text-white focus:outline-none cursor-pointer"
          >
            <option value="publishedAt">{t('mostRecent')}</option>
            <option value="views">{t('mostViews')}</option>
            <option value="comments">{t('mostComments')}</option>
            <option value="revenue">{t('highestRevenue')}</option>
          </select>

          <button
            onClick={() => syncAllChannels()}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? t('syncingBtn') : t('loadVideos')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredVideos.slice(0, 36).map((v) => {
          const ch = channelMap.get(v.channelId);
          const lang = ch ? langMap.get(ch.languageId) : undefined;
          const youtubeUrl = !v.id.startsWith('vid-')
            ? v.isShort
              ? `https://www.youtube.com/shorts/${v.id}`
              : `https://www.youtube.com/watch?v=${v.id}`
            : null;
          return (
            <div
              key={v.id}
              className="rounded-2xl bg-[#121720] border border-slate-800/90 overflow-hidden hover:border-slate-700 transition flex flex-col"
            >
              <div className="relative h-40 bg-slate-900">
                {youtubeUrl ? (
                  <a
                    href={youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full h-full group"
                  >
                    <img
                      src={v.thumbnailUrl}
                      alt={v.title}
                      className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition"
                    />
                  </a>
                ) : (
                  <img
                    src={v.thumbnailUrl}
                    alt={v.title}
                    className="w-full h-full object-cover opacity-85"
                  />
                )}
                <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[11px] font-mono-num text-white">
                  {formatDuration(v.durationSec)}
                </span>
                {v.isShort && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-orange-500 text-[10px] font-bold uppercase text-white">
                    Short
                  </span>
                )}
                {lang && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/75 text-[11px] text-white border border-white/10">
                    {lang.flag} {lang.code}
                  </span>
                )}
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  {youtubeUrl ? (
                    <a
                      href={youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-white hover:text-orange-400 transition line-clamp-2 mb-1 block"
                    >
                      {v.title}
                    </a>
                  ) : (
                    <h3 className="text-sm font-semibold text-white line-clamp-2 mb-1">
                      {v.title}
                    </h3>
                  )}
                  <div className="text-xs text-slate-400 flex items-center justify-between gap-2">
                    <span>{ch?.name}</span>
                    <div className="flex items-center gap-2">
                      <span>{v.publishedAt}</span>
                      {youtubeUrl && (
                        <a
                          href={youtubeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir vídeo no YouTube"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 font-medium transition"
                        >
                          YouTube
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-800/70 text-center">
                  <div>
                    <div className="text-xs font-bold font-mono-num text-white flex items-center justify-center gap-1">
                      <Eye className="w-3 h-3 text-orange-400" />
                      {formatCompact(v.views)}
                    </div>
                    <div className="text-[10px] text-slate-500">Views</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold font-mono-num text-slate-200 flex items-center justify-center gap-1">
                      <ThumbsUp className="w-3 h-3 text-sky-400" />
                      {formatNumber(v.likes)}
                    </div>
                    <div className="text-[10px] text-slate-500">Likes</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold font-mono-num text-slate-200 flex items-center justify-center gap-1">
                      <MessageSquare className="w-3 h-3 text-violet-400" />
                      {formatNumber(v.comments)}
                    </div>
                    <div className="text-[10px] text-slate-500">Comentários</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold font-mono-num text-emerald-400">
                      {formatCurrency(v.revenue)}
                    </div>
                    <div className="text-[10px] text-slate-500">Receita</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
