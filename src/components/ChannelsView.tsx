import React, { useState } from 'react';
import { ExternalLink, FolderPlus, Globe2, Pencil, Plus, Power, RefreshCw, Trash2, Tv2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Channel } from '../types/youtube';
import { formatCompact, formatCurrency } from '../utils/formatters';

const PRESET_COLORS = [
  '#f97316',
  '#22c55e',
  '#3b82f6',
  '#a855f7',
  '#eab308',
  '#ec4899',
  '#06b6d4',
  '#ef4444',
];

export function ChannelsView() {
  const {
    channels,
    languages,
    groups,
    addChannel,
    updateChannel,
    deleteChannel,
    toggleChannelActive,
    syncChannelVideos,
    addLanguage,
    addGroup,
    deleteGroup,
    selectedLanguageId,
    selectedGroupId,
    selectedChannelId,
    t,
  } = useStore();

  const [showAddChannel, setShowAddChannel] = useState(false);
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [syncingChannelId, setSyncingChannelId] = useState<string | null>(null);
  const [showAddLanguage, setShowAddLanguage] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);

  // Add Channel form
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [ytId, setYtId] = useState('');
  const [languageId, setLanguageId] = useState(languages[0]?.id || 'pt-BR');
  const [groupId, setGroupId] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [rpm, setRpm] = useState('2.50');
  const [ctr, setCtr] = useState('6.2');
  const [tsSearch, setTsSearch] = useState('57');
  const [tsBrowse, setTsBrowse] = useState('13');
  const [tsSuggested, setTsSuggested] = useState('13');
  const [tsShorts, setTsShorts] = useState('10');
  const [tsOther, setTsOther] = useState('7');
  const [demoGender, setDemoGender] = useState('Masculino');
  const [demoAgeRange, setDemoAgeRange] = useState('Mais de 65 anos');
  const [vbNew, setVbNew] = useState('99');
  const [vbCasual, setVbCasual] = useState('1');
  const [vbReturning, setVbReturning] = useState('0');
  const [devMobile, setDevMobile] = useState('70.4');
  const [devDesktop, setDevDesktop] = useState('13.2');
  const [devTv, setDevTv] = useState('12.2');
  const [devTablet, setDevTablet] = useState('4.2');
  const [geographiesText, setGeographiesText] = useState(
    'Brasil: 45.4, Portugal: 37.4, Moçambique: 1.2, Angola: 1.2'
  );
  const [age13_17, setAge13_17] = useState('8.0');
  const [age18_24, setAge18_24] = useState('1.9');
  const [age25_34, setAge25_34] = useState('24.4');
  const [age35_44, setAge35_44] = useState('28.6');
  const [age45_54, setAge45_54] = useState('20.1');
  const [age55_64, setAge55_64] = useState('6.3');
  const [age65plus, setAge65plus] = useState('10.8');
  const [genFemale, setGenFemale] = useState('14.3');
  const [genMale, setGenMale] = useState('85.7');
  const [genCustom, setGenCustom] = useState('0.0');
  const [submitting, setSubmitting] = useState(false);

  // Add Language form
  const [langName, setLangName] = useState('');
  const [langCode, setLangCode] = useState('');
  const [langFlag, setLangFlag] = useState('🇩🇪');
  const [langColor, setLangColor] = useState('#06b6d4');

  // Add Group form
  const [groupName, setGroupName] = useState('');
  const [groupIcon, setGroupIcon] = useState('📁');
  const [groupColor, setGroupColor] = useState('#f97316');
  const [groupChannelIds, setGroupChannelIds] = useState<string[]>([]);

  const langMap = new Map(languages.map((l) => [l.id, l]));
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  const visibleChannels = channels.filter((ch) => {
    if (selectedLanguageId !== 'all' && ch.languageId !== selectedLanguageId) return false;
    if (selectedGroupId !== 'all' && ch.groupId !== selectedGroupId) return false;
    if (selectedChannelId !== 'all' && ch.id !== selectedChannelId) return false;
    return true;
  });

  const openNewChannelForm = () => {
    setEditingChannelId(null);
    setName('');
    setHandle('');
    setYtId('');
    setLanguageId(languages[0]?.id || 'pt-BR');
    setGroupId('');
    setColor(PRESET_COLORS[0]);
    setRpm('2.50');
    setCtr('6.2');
    setTsSearch('57');
    setTsBrowse('13');
    setTsSuggested('13');
    setTsShorts('10');
    setTsOther('7');
    setDemoGender('Masculino');
    setDemoAgeRange('Mais de 65 anos');
    setVbNew('99');
    setVbCasual('1');
    setVbReturning('0');
    setDevMobile('70.4');
    setDevDesktop('13.2');
    setDevTv('12.2');
    setDevTablet('4.2');
    setGeographiesText('Brasil: 45.4, Portugal: 37.4, Moçambique: 1.2, Angola: 1.2');
    setAge13_17('8.0');
    setAge18_24('1.9');
    setAge25_34('24.4');
    setAge35_44('28.6');
    setAge45_54('20.1');
    setAge55_64('6.3');
    setAge65plus('10.8');
    setGenFemale('14.3');
    setGenMale('85.7');
    setGenCustom('0.0');
    setShowAddChannel((v) => !v);
  };

  const defaultGeoString = (langId: string) => {
    if (langId === 'en') return 'Estados Unidos: 42.0, Reino Unido: 18.5, Canadá: 11.2, Austrália: 8.4';
    if (langId === 'fr') return 'França: 58.0, Canadá: 14.2, Bélgica: 10.5, Suíça: 6.1';
    if (langId === 'es') return 'México: 36.4, Espanha: 22.8, Argentina: 14.5, Colômbia: 11.2';
    return 'Brasil: 45.4, Portugal: 37.4, Moçambique: 1.2, Angola: 1.2';
  };

  const openEditChannelForm = (ch: Channel) => {
    setEditingChannelId(ch.id);
    setName(ch.name);
    setHandle(ch.handle);
    setYtId(ch.youtubeChannelId || '');
    setLanguageId(ch.languageId);
    setGroupId(ch.groupId || '');
    setColor(ch.color);
    setRpm(ch.rpm.toFixed(2));
    setCtr((ch.ctr ?? 6.2).toFixed(1));
    setTsSearch(String(ch.trafficSources?.search ?? 57));
    setTsBrowse(String(ch.trafficSources?.browse ?? 13));
    setTsSuggested(String(ch.trafficSources?.suggested ?? 13));
    setTsShorts(String(ch.trafficSources?.shorts ?? 10));
    setTsOther(String(ch.trafficSources?.other ?? 7));
    setDemoGender(ch.demographic?.gender || 'Masculino');
    setDemoAgeRange(ch.demographic?.ageRange || 'Mais de 65 anos');
    setVbNew(String(ch.viewerBehavior?.newViewers ?? 99));
    setVbCasual(String(ch.viewerBehavior?.casualViewers ?? 1));
    setVbReturning(String(ch.viewerBehavior?.returningViewers ?? 0));
    setDevMobile(String(ch.deviceTypes?.mobile ?? 70.4));
    setDevDesktop(String(ch.deviceTypes?.desktop ?? 13.2));
    setDevTv(String(ch.deviceTypes?.tv ?? 12.2));
    setDevTablet(String(ch.deviceTypes?.tablet ?? 4.2));
    setGeographiesText(
      ch.geographies?.length
        ? ch.geographies.map((g) => `${g.country}: ${g.pct}`).join(', ')
        : defaultGeoString(ch.languageId)
    );
    setAge13_17(String(ch.ageBreakdown?.a13_17 ?? 8.0));
    setAge18_24(String(ch.ageBreakdown?.a18_24 ?? 1.9));
    setAge25_34(String(ch.ageBreakdown?.a25_34 ?? 24.4));
    setAge35_44(String(ch.ageBreakdown?.a35_44 ?? 28.6));
    setAge45_54(String(ch.ageBreakdown?.a45_54 ?? 20.1));
    setAge55_64(String(ch.ageBreakdown?.a55_64 ?? 6.3));
    setAge65plus(String(ch.ageBreakdown?.a65plus ?? 10.8));
    setGenFemale(String(ch.genderBreakdown?.female ?? 14.3));
    setGenMale(String(ch.genderBreakdown?.male ?? 85.7));
    setGenCustom(String(ch.genderBreakdown?.custom ?? 0.0));
    setShowAddChannel(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateOrUpdateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !handle.trim()) return;
    setSubmitting(true);
    try {
      const normalizedHandle = handle.trim().startsWith('@')
        ? handle.trim()
        : `@${handle.trim()}`;
      const parsedRpm = parseFloat(rpm) || 2.5;
      const parsedCtr = parseFloat(ctr) || 6.2;
      const trafficSources = {
        search: parseFloat(tsSearch) || 0,
        browse: parseFloat(tsBrowse) || 0,
        suggested: parseFloat(tsSuggested) || 0,
        shorts: parseFloat(tsShorts) || 0,
        other: parseFloat(tsOther) || 0,
      };
      const demographic = {
        gender: demoGender,
        ageRange: demoAgeRange,
      };
      const viewerBehavior = {
        newViewers: parseFloat(vbNew) || 0,
        casualViewers: parseFloat(vbCasual) || 0,
        returningViewers: parseFloat(vbReturning) || 0,
      };
      const deviceTypes = {
        mobile: parseFloat(devMobile) || 0,
        desktop: parseFloat(devDesktop) || 0,
        tv: parseFloat(devTv) || 0,
        tablet: parseFloat(devTablet) || 0,
      };
      const geographies = geographiesText
        .split(',')
        .map((part) => {
          const [countryRaw, pctRaw] = part.split(':');
          const country = (countryRaw || '').trim();
          const pct = parseFloat((pctRaw || '0').replace(',', '.').trim()) || 0;
          return country ? { country, pct } : null;
        })
        .filter((x): x is { country: string; pct: number } => x !== null);

      const ageBreakdown = {
        a13_17: parseFloat(age13_17) || 0,
        a18_24: parseFloat(age18_24) || 0,
        a25_34: parseFloat(age25_34) || 0,
        a35_44: parseFloat(age35_44) || 0,
        a45_54: parseFloat(age45_54) || 0,
        a55_64: parseFloat(age55_64) || 0,
        a65plus: parseFloat(age65plus) || 0,
      };

      const genderBreakdown = {
        female: parseFloat(genFemale) || 0,
        male: parseFloat(genMale) || 0,
        custom: parseFloat(genCustom) || 0,
      };

      if (editingChannelId) {
        updateChannel(editingChannelId, {
          name: name.trim(),
          handle: normalizedHandle,
          youtubeChannelId: ytId.trim() || undefined,
          languageId,
          groupId: groupId || undefined,
          color,
          rpm: parsedRpm,
          cpm: Number((parsedRpm * 1.75).toFixed(2)),
          ctr: parsedCtr,
          trafficSources,
          demographic,
          viewerBehavior,
          deviceTypes,
          geographies,
          ageBreakdown,
          genderBreakdown,
        });
        setEditingChannelId(null);
      } else {
        await addChannel({
          name,
          handle: normalizedHandle,
          youtubeChannelId: ytId || undefined,
          languageId,
          groupId: groupId || undefined,
          color,
          rpm: parsedRpm,
          ctr: parsedCtr,
        });
      }
      setName('');
      setHandle('');
      setYtId('');
      setShowAddChannel(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateLanguage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!langName.trim() || !langCode.trim()) return;
    const created = addLanguage({
      name: langName,
      code: langCode,
      flag: langFlag,
      color: langColor,
    });
    setLanguageId(created.id);
    setLangName('');
    setLangCode('');
    setShowAddLanguage(false);
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    addGroup({
      name: groupName,
      icon: groupIcon,
      color: groupColor,
      channelIds: groupChannelIds,
    });
    setGroupName('');
    setGroupChannelIds([]);
    setShowAddGroup(false);
  };

  const toggleGroupChannel = (id: string) => {
    setGroupChannelIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Tv2 className="w-5 h-5 text-orange-400" />
            {t('connectedChannels')} ({visibleChannels.length}
            {visibleChannels.length !== channels.length ? ` / ${channels.length}` : ''})
          </h2>
          <p className="text-xs text-slate-400">
            {t('navChannels')}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowAddGroup((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#131a24] hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
          >
            <FolderPlus className="w-4 h-4 text-violet-400" />
            {t('newGroup')}
          </button>

          <button
            onClick={() => setShowAddLanguage((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#131a24] hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
          >
            <Globe2 className="w-4 h-4 text-sky-400" />
            {t('newLanguage')}
          </button>

          <button
            onClick={openNewChannelForm}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold shadow-lg shadow-orange-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {t('addChannel')}
          </button>
        </div>
      </div>

      {/* Existing Groups Strip */}
      {groups.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {groups.map((grp) => {
            const count = channels.filter((c) => c.groupId === grp.id).length;
            return (
              <div
                key={grp.id}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#121720] border border-slate-800 text-xs text-slate-200"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: grp.color }}
                />
                <span>{grp.icon}</span>
                <span className="font-semibold">{grp.name}</span>
                <span className="text-slate-400 font-mono-num">({count} canais)</span>
                <button
                  onClick={() => deleteGroup(grp.id)}
                  title="Excluir grupo"
                  className="text-slate-500 hover:text-rose-400 transition cursor-pointer ml-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Group Panel */}
      {showAddGroup && (
        <form
          onSubmit={handleCreateGroup}
          className="rounded-2xl bg-[#121720] border border-violet-500/40 p-5 space-y-4"
        >
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-violet-400" />
            Criar Novo Grupo de Canais (ex.: Atlas Temple, Bug Humano)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nome do Grupo *</label>
              <input
                type="text"
                required
                placeholder="Ex: Atlas Temple"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-sm text-white focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Ícone (Emoji)</label>
              <input
                type="text"
                value={groupIcon}
                onChange={(e) => setGroupIcon(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-sm text-white focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Cor no Gráfico</label>
              <input
                type="color"
                value={groupColor}
                onChange={(e) => setGroupColor(e.target.value)}
                className="w-full h-9 rounded-xl bg-[#0b0f14] border border-slate-700 cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-2">
              Selecione os canais deste grupo:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {channels.map((ch) => {
                const checked = groupChannelIds.includes(ch.id);
                const lang = langMap.get(ch.languageId);
                return (
                  <label
                    key={ch.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs cursor-pointer transition ${
                      checked
                        ? 'bg-violet-500/15 border-violet-500/50 text-white'
                        : 'bg-[#0b0f14] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleGroupChannel(ch.id)}
                      className="accent-violet-500"
                    />
                    <span className="truncate flex-1">{ch.name}</span>
                    {lang && <span className="text-[11px]">{lang.flag}</span>}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddGroup(false)}
              className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold cursor-pointer"
            >
              Salvar Grupo
            </button>
          </div>
        </form>
      )}

      {/* Add Language Panel */}
      {showAddLanguage && (
        <form
          onSubmit={handleCreateLanguage}
          className="rounded-2xl bg-[#121720] border border-sky-500/40 p-5 space-y-4"
        >
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-sky-400" />
            Adicionar Novo Idioma (escalável para futuras expansões)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nome do Idioma</label>
              <input
                type="text"
                required
                placeholder="Ex: Alemão"
                value={langName}
                onChange={(e) => setLangName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Código</label>
              <input
                type="text"
                required
                placeholder="Ex: DE"
                value={langCode}
                onChange={(e) => setLangCode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Bandeira (Emoji)</label>
              <input
                type="text"
                value={langFlag}
                onChange={(e) => setLangFlag(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Cor no Gráfico</label>
              <input
                type="color"
                value={langColor}
                onChange={(e) => setLangColor(e.target.value)}
                className="w-full h-9 rounded-xl bg-[#0b0f14] border border-slate-700 cursor-pointer"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddLanguage(false)}
              className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold cursor-pointer"
            >
              Salvar Idioma
            </button>
          </div>
        </form>
      )}

      {/* Add / Edit Channel Panel */}
      {showAddChannel && (
        <form
          onSubmit={handleCreateOrUpdateChannel}
          className="rounded-2xl bg-[#121720] border border-orange-500/40 p-5 space-y-4"
        >
          <div className="text-sm font-bold text-white flex items-center gap-2">
            {editingChannelId ? (
              <>
                <Pencil className="w-4 h-4 text-orange-400" />
                Editar Canal
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 text-orange-400" />
                Adicionar Novo Canal do YouTube
              </>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nome do Canal *</label>
              <input
                type="text"
                required
                placeholder="Ex: Canal Alemanha"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-sm text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Handle (@) *</label>
              <input
                type="text"
                required
                placeholder="Ex: @MeuCanalDE"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-sm text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                YouTube Channel ID (opcional para API real)
              </label>
              <input
                type="text"
                placeholder="Ex: UCxxxxxxxx..."
                value={ytId}
                onChange={(e) => setYtId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-sm text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Idioma</label>
              <select
                value={languageId}
                onChange={(e) => setLanguageId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-sm text-white focus:outline-none focus:border-orange-500"
              >
                {languages.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.flag} {l.name} ({l.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Grupo (opcional)</label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-sm text-white focus:outline-none focus:border-orange-500"
              >
                <option value="">Sem grupo</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.icon} {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">RPM Estimado (USD)</label>
              <input
                type="number"
                step="0.1"
                value={rpm}
                onChange={(e) => setRpm(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-sm text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">CTR (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={ctr}
                onChange={(e) => setCtr(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-sm text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Cor no Gráfico</label>
              <div className="flex items-center gap-2 pt-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full cursor-pointer transition ${
                      color === c ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80">
            <div className="text-xs font-semibold text-slate-300 mb-2">
              Como os visitantes encontram o conteúdo (% do YouTube Studio)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Pesquisa YouTube (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={tsSearch}
                  onChange={(e) => setTsSearch(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Navegação (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={tsBrowse}
                  onChange={(e) => setTsBrowse(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Vídeos Sugeridos (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={tsSuggested}
                  onChange={(e) => setTsSuggested(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Feed dos Shorts (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={tsShorts}
                  onChange={(e) => setTsShorts(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Externo / Outros (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={tsOther}
                  onChange={(e) => setTsOther(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80">
            <div className="text-xs font-semibold text-slate-300 mb-2">
              Principal grupo demográfico (YouTube Studio)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Gênero</label>
                <select
                  value={demoGender}
                  onChange={(e) => setDemoGender(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="Masculino">Masculino</option>
                  <option value="Feminino">Feminino</option>
                  <option value="Misto">Misto</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Faixa Etária</label>
                <select
                  value={demoAgeRange}
                  onChange={(e) => setDemoAgeRange(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="13-17 anos">13-17 anos</option>
                  <option value="18-24 anos">18-24 anos</option>
                  <option value="25-34 anos">25-34 anos</option>
                  <option value="35-44 anos">35-44 anos</option>
                  <option value="45-54 anos">45-54 anos</option>
                  <option value="55-64 anos">55-64 anos</option>
                  <option value="Mais de 65 anos">Mais de 65 anos</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80">
            <div className="text-xs font-semibold text-slate-300 mb-2">
              Comportamento de visualização (% Público mensal)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Novos visitantes (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={vbNew}
                  onChange={(e) => setVbNew(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Visitantes ocasionais (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={vbCasual}
                  onChange={(e) => setVbCasual(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Visitantes habituais (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={vbReturning}
                  onChange={(e) => setVbReturning(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80">
            <div className="text-xs font-semibold text-slate-300 mb-2">
              Tipo de dispositivo (% Tempo de visualização)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Telemóvel (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={devMobile}
                  onChange={(e) => setDevMobile(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Computador (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={devDesktop}
                  onChange={(e) => setDevDesktop(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">TV (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={devTv}
                  onChange={(e) => setDevTv(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Tablet (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={devTablet}
                  onChange={(e) => setDevTablet(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Principais geografias (País: %, separados por vírgula)
            </label>
            <input
              type="text"
              placeholder="Ex: Brasil: 45.4, Portugal: 37.4, Moçambique: 1.2, Angola: 1.2"
              value={geographiesText}
              onChange={(e) => setGeographiesText(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-800/80">
            <div className="text-xs font-semibold text-slate-300 mb-2">
              Idade (% Visualizações do YouTube Studio)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {[
                { label: '13-17', val: age13_17, set: setAge13_17 },
                { label: '18-24', val: age18_24, set: setAge18_24 },
                { label: '25-34', val: age25_34, set: setAge25_34 },
                { label: '35-44', val: age35_44, set: setAge35_44 },
                { label: '45-54', val: age45_54, set: setAge45_54 },
                { label: '55-64', val: age55_64, set: setAge55_64 },
                { label: '65+', val: age65plus, set: setAge65plus },
              ].map((item) => (
                <div key={item.label}>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    {item.label} (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={item.val}
                    onChange={(e) => item.set(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80">
            <div className="text-xs font-semibold text-slate-300 mb-2">
              Género (% Visualizações do YouTube Studio)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Feminino (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={genFemale}
                  onChange={(e) => setGenFemale(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Masculino (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={genMale}
                  onChange={(e) => setGenMale(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Especificado pelo utilizador (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={genCustom}
                  onChange={(e) => setGenCustom(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAddChannel(false);
                setEditingChannelId(null);
              }}
              className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              {submitting
                ? 'Salvando...'
                : editingChannelId
                ? 'Salvar Alterações'
                : 'Adicionar Canal'}
            </button>
          </div>
        </form>
      )}

      {/* Channels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {visibleChannels.map((ch) => {
          const lang = langMap.get(ch.languageId);
          const grp = ch.groupId ? groupMap.get(ch.groupId) : undefined;
          return (
            <div
              key={ch.id}
              className={`rounded-2xl p-4 border transition ${
                ch.isActive
                  ? 'bg-[#121720] border-slate-800/90'
                  : 'bg-[#0e131a] border-slate-800/40 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={ch.avatarUrl}
                    alt={ch.name}
                    className="w-11 h-11 rounded-full border-2 shrink-0"
                    style={{ borderColor: ch.color }}
                  />
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-white truncate">{ch.name}</h3>
                    <p className="text-xs text-slate-400 truncate">{ch.handle}</p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  {lang && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-[#0b0f14] border border-slate-800 text-slate-200">
                      {lang.flag} {lang.code}
                    </span>
                  )}
                  {grp && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-violet-500/15 border border-violet-500/30 text-violet-300">
                      {grp.icon} {grp.name}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center mb-4">
                <div className="rounded-xl bg-[#0b0f14] p-2 border border-slate-800/70">
                  <div className="text-xs font-bold font-mono-num text-white">
                    {formatCompact(ch.subscribersTotal)}
                  </div>
                  <div className="text-[10px] text-slate-500">Inscritos</div>
                </div>
                <div className="rounded-xl bg-[#0b0f14] p-2 border border-slate-800/70">
                  <div className="text-xs font-bold font-mono-num text-white">
                    {formatCompact(ch.viewsTotal)}
                  </div>
                  <div className="text-[10px] text-slate-500">Views</div>
                </div>
                <div className="rounded-xl bg-[#0b0f14] p-2 border border-slate-800/70">
                  <div className="text-xs font-bold font-mono-num text-emerald-400">
                    {formatCurrency(ch.rpm)}
                  </div>
                  <div className="text-[10px] text-slate-500">RPM</div>
                </div>
                <button
                  type="button"
                  onClick={() => openEditChannelForm(ch)}
                  title="CTR é um dado privado do YouTube Studio — clique para informar o CTR real ou importe o CSV em Configurações"
                  className="rounded-xl bg-[#0b0f14] hover:border-orange-500/50 p-2 border border-slate-800/70 transition cursor-pointer"
                >
                  <div className="text-xs font-bold font-mono-num text-orange-400">
                    {ch.ctr !== undefined ? `${ch.ctr.toFixed(1)}%` : '--'}
                  </div>
                  <div className="text-[10px] text-slate-500">CTR (editar)</div>
                </button>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800/70">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleChannelActive(ch.id)}
                    className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      ch.isActive
                        ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    {ch.isActive ? t('active') : t('paused')}
                  </button>

                  <a
                    href={
                      ch.youtubeChannelId
                        ? `https://www.youtube.com/channel/${ch.youtubeChannelId}`
                        : `https://www.youtube.com/${
                            ch.handle.startsWith('@') ? ch.handle : `@${ch.handle}`
                          }`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir canal no YouTube"
                    className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 transition"
                  >
                    YouTube
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <a
                    href={
                      ch.youtubeChannelId
                        ? `https://studio.youtube.com/channel/${ch.youtubeChannelId}/videos/upload?d=ud`
                        : 'https://studio.youtube.com/'
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir YouTube Studio para carregar vídeo neste canal"
                    className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition"
                  >
                    <Plus className="w-3.5 h-3.5 text-orange-400" />
                    {t('createBtn')}
                  </a>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={async () => {
                      setSyncingChannelId(ch.id);
                      try {
                        await syncChannelVideos(ch.id);
                      } finally {
                        setSyncingChannelId(null);
                      }
                    }}
                    disabled={syncingChannelId === ch.id}
                    title="Atualizar vídeos deste canal"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 transition cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${
                        syncingChannelId === ch.id ? 'animate-spin' : ''
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => openEditChannelForm(ch)}
                    title="Editar canal"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 transition cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteChannel(ch.id)}
                    title="Remover canal"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
