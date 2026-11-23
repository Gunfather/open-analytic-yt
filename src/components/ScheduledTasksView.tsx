import React, { useState } from 'react';
import {
  CalendarClock,
  Mail,
  Pencil,
  Plus,
  Power,
  Send,
  Settings2,
  Trash2,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import {
  PeriodOption,
  ScheduledTask,
  ScheduledTaskSections,
  ScheduleFrequency,
} from '../types/youtube';

const WEEKDAYS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

const PERIOD_LABELS: Record<PeriodOption, string> = {
  '24h': 'Últimas 24 horas',
  '48h': 'Últimas 48 horas',
  '7d': 'Últimos 7 dias',
  '14d': 'Últimos 14 dias',
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 90 dias',
};

export function ScheduledTasksView() {
  const {
    languages,
    groups,
    channels,
    scheduledTasks,
    smtpConfig,
    setSmtpConfig,
    addScheduledTask,
    updateScheduledTask,
    deleteScheduledTask,
    toggleScheduledTask,
    runScheduledTaskNow,
  } = useStore();

  const [showSmtp, setShowSmtp] = useState(!smtpConfig.user || !smtpConfig.pass);
  const [showForm, setShowForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // SMTP draft
  const [smtpHost, setSmtpHost] = useState(smtpConfig.host);
  const [smtpPort, setSmtpPort] = useState(String(smtpConfig.port));
  const [smtpSecure, setSmtpSecure] = useState(smtpConfig.secure);
  const [smtpUser, setSmtpUser] = useState(smtpConfig.user);
  const [smtpPass, setSmtpPass] = useState(smtpConfig.pass);
  const [smtpSavedMsg, setSmtpSavedMsg] = useState('');

  // New Task form
  const [name, setName] = useState('');
  const [toEmail, setToEmail] = useState('');
  const [frequency, setFrequency] = useState<ScheduleFrequency>('daily');
  const [time, setTime] = useState('09:00');
  const [weekday, setWeekday] = useState(1);
  const [monthDay, setMonthDay] = useState(1);
  const [onceDate, setOnceDate] = useState(new Date().toISOString().slice(0, 10));
  const [period, setPeriod] = useState<PeriodOption>('7d');
  const [languageId, setLanguageId] = useState('all');
  const [groupId, setGroupId] = useState('all');
  const [channelId, setChannelId] = useState('all');
  const [topVideosLimit, setTopVideosLimit] = useState(15);
  const [aiNote, setAiNote] = useState(
    'Analise crescimento, CTR, retenção e compare os idiomas/grupos.'
  );
  const [sections, setSections] = useState<ScheduledTaskSections>({
    kpis: true,
    byLanguage: true,
    byChannel: true,
    topVideos: true,
    topEngagement: true,
    audienceDetails: true,
  });

  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [runFeedback, setRunFeedback] = useState<string | null>(null);

  const langMap = new Map(languages.map((l) => [l.id, l]));
  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const chMap = new Map(channels.map((c) => [c.id, c]));

  const handleSaveSmtp = (e: React.FormEvent) => {
    e.preventDefault();
    setSmtpConfig({
      host: smtpHost.trim(),
      port: parseInt(smtpPort, 10) || 587,
      secure: smtpSecure,
      user: smtpUser.trim(),
      pass: smtpPass,
    });
    setSmtpSavedMsg('Configuração SMTP salva!');
    setTimeout(() => setSmtpSavedMsg(''), 3000);
  };

  const openNewTaskForm = () => {
    setEditingTaskId(null);
    setName('');
    setToEmail('');
    setFrequency('daily');
    setTime('09:00');
    setWeekday(1);
    setMonthDay(1);
    setOnceDate(new Date().toISOString().slice(0, 10));
    setPeriod('7d');
    setLanguageId('all');
    setGroupId('all');
    setChannelId('all');
    setTopVideosLimit(15);
    setAiNote('Analise crescimento, CTR, retenção e compare os idiomas/grupos.');
    setSections({
      kpis: true,
      byLanguage: true,
      byChannel: true,
      topVideos: true,
      topEngagement: true,
      audienceDetails: true,
    });
    setShowForm((v) => !v);
  };

  const openEditTaskForm = (task: ScheduledTask) => {
    setEditingTaskId(task.id);
    setName(task.name);
    setToEmail(task.toEmail);
    setFrequency(task.frequency);
    setTime(task.time);
    setWeekday(task.weekday ?? 1);
    setMonthDay(task.monthDay ?? 1);
    setOnceDate(task.onceDate || new Date().toISOString().slice(0, 10));
    setPeriod(task.period);
    setLanguageId(task.languageId);
    setGroupId(task.groupId);
    setChannelId(task.channelId);
    setTopVideosLimit(task.topVideosLimit);
    setAiNote(task.aiNote || '');
    setSections(task.sections);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateOrUpdateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !toEmail.trim()) return;
    const payload = {
      name: name.trim(),
      toEmail: toEmail.trim(),
      frequency,
      time,
      weekday: frequency === 'weekly' ? weekday : undefined,
      monthDay: frequency === 'monthly' ? monthDay : undefined,
      onceDate: frequency === 'once' ? onceDate : undefined,
      period,
      languageId,
      groupId,
      channelId,
      topVideosLimit,
      sections,
      aiNote: aiNote.trim() || undefined,
    };

    if (editingTaskId) {
      updateScheduledTask(editingTaskId, payload);
      setEditingTaskId(null);
    } else {
      addScheduledTask({ ...payload, isActive: true });
    }
    setName('');
    setShowForm(false);
  };

  const handleRunNow = async (id: string) => {
    setRunningTaskId(id);
    setRunFeedback(null);
    try {
      const res = await runScheduledTaskNow(id);
      setRunFeedback(res.message);
    } finally {
      setRunningTaskId(null);
    }
  };

  const toggleSection = (key: keyof ScheduledTaskSections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-orange-400" />
            Tarefas Agendadas de Relatórios por E-mail ({scheduledTasks.length})
          </h2>
          <p className="text-xs text-slate-400">
            Agende envios automáticos em PDF com todos os filtros (período, idioma, grupo, canal, dias e horas). Mantenha o painel aberto para disparo automático.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSmtp((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#131a24] hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
          >
            <Settings2 className="w-4 h-4 text-sky-400" />
            Configurar E-mail (SMTP)
          </button>

          <button
            onClick={openNewTaskForm}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold shadow-lg shadow-orange-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nova Tarefa Agendada
          </button>
        </div>
      </div>

      {runFeedback && (
        <div className="rounded-xl bg-[#121720] border border-slate-700 px-4 py-2.5 text-xs text-slate-200">
          {runFeedback}
        </div>
      )}

      {/* SMTP Configuration */}
      {showSmtp && (
        <form
          onSubmit={handleSaveSmtp}
          className="rounded-2xl bg-[#121720] border border-sky-500/40 p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-sky-400" />
              Servidor de E-mail Remetente (SMTP)
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setSmtpHost('smtp.gmail.com');
                  setSmtpPort('587');
                  setSmtpSecure(false);
                }}
                className="px-2.5 py-1 rounded-lg bg-[#0b0f14] border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
              >
                Usar Gmail
              </button>
              <button
                type="button"
                onClick={() => {
                  setSmtpHost('smtp-mail.outlook.com');
                  setSmtpPort('587');
                  setSmtpSecure(false);
                }}
                className="px-2.5 py-1 rounded-lg bg-[#0b0f14] border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
              >
                Usar Outlook
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Host SMTP</label>
              <input
                type="text"
                required
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Porta</label>
              <input
                type="number"
                required
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Seu E-mail (Remetente)</label>
              <input
                type="email"
                required
                placeholder="seuemail@gmail.com"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Senha de App (App Password)
              </label>
              <input
                type="password"
                required
                placeholder="abcd efgh ijkl mnop"
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-400">
              No Gmail, use uma <strong className="text-slate-200">Senha de App</strong> (Conta Google → Segurança → Senhas de app).
            </span>
            <div className="flex items-center gap-3">
              {smtpSavedMsg && (
                <span className="text-xs text-emerald-400">{smtpSavedMsg}</span>
              )}
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold cursor-pointer"
              >
                Salvar SMTP
              </button>
            </div>
          </div>
        </form>
      )}

      {/* New / Edit Scheduled Task Form */}
      {showForm && (
        <form
          onSubmit={handleCreateOrUpdateTask}
          className="rounded-2xl bg-[#121720] border border-orange-500/40 p-5 space-y-5"
        >
          <div className="text-sm font-bold text-white flex items-center gap-2">
            {editingTaskId ? (
              <>
                <Pencil className="w-4 h-4 text-orange-400" />
                Editar Tarefa Agendada
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 text-orange-400" />
                Criar Nova Tarefa Agendada
              </>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nome da Tarefa *</label>
              <input
                type="text"
                required
                placeholder="Ex: Relatório Diário 09h"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                E-mail(s) de Destino *
              </label>
              <input
                type="text"
                required
                placeholder="destinatario@email.com"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Frequência</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as ScheduleFrequency)}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
              >
                <option value="daily">Diário (todos os dias)</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
                <option value="once">Data específica (Único)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Horário de Envio *</label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            {frequency === 'weekly' && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Dia da Semana</label>
                <select
                  value={weekday}
                  onChange={(e) => setWeekday(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                >
                  {WEEKDAYS.map((day, idx) => (
                    <option key={day} value={idx}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {frequency === 'monthly' && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Dia do Mês (1-28)</label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={monthDay}
                  onChange={(e) => setMonthDay(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            )}

            {frequency === 'once' && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Data Específica</label>
                <input
                  type="date"
                  value={onceDate}
                  onChange={(e) => setOnceDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-400 mb-1">Período dos Dados</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as PeriodOption)}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
              >
                {(Object.keys(PERIOD_LABELS) as PeriodOption[]).map((k) => (
                  <option key={k} value={k}>
                    {PERIOD_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Idioma</label>
              <select
                value={languageId}
                onChange={(e) => {
                  setLanguageId(e.target.value);
                  setChannelId('all');
                }}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
              >
                <option value="all">Todos os Idiomas</option>
                {languages.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.flag} {l.name} ({l.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Grupo</label>
              <select
                value={groupId}
                onChange={(e) => {
                  setGroupId(e.target.value);
                  setChannelId('all');
                }}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
              >
                <option value="all">Todos os Grupos</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.icon} {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Canal</label>
              <select
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
              >
                <option value="all">Todos os Canais</option>
                {channels
                  .filter((c) => c.isActive)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.handle})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Qtd. Top Vídeos</label>
              <select
                value={topVideosLimit}
                onChange={(e) => setTopVideosLimit(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(
              [
                { key: 'kpis', label: 'Resumo Executivo (KPIs)' },
                { key: 'byLanguage', label: 'Comparativo por Idioma' },
                { key: 'byChannel', label: 'Desempenho por Canal' },
                { key: 'topVideos', label: `Top ${topVideosLimit} Vídeos` },
                { key: 'topEngagement', label: 'Top Likes & Comentários' },
                { key: 'audienceDetails', label: 'Audiência & Dispositivos' },
              ] as Array<{ key: keyof ScheduledTaskSections; label: string }>
            ).map((item) => (
              <label
                key={item.key}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs cursor-pointer ${
                  sections[item.key]
                    ? 'bg-orange-500/15 border-orange-500/40 text-white'
                    : 'bg-[#0b0f14] border-slate-800 text-slate-400'
                }`}
              >
                <input
                  type="checkbox"
                  checked={sections[item.key]}
                  onChange={() => toggleSection(item.key)}
                  className="accent-orange-500"
                />
                {item.label}
              </label>
            ))}
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Nota / Instrução para IA no Relatório
            </label>
            <input
              type="text"
              value={aiNote}
              onChange={(e) => setAiNote(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingTaskId(null);
              }}
              className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold cursor-pointer"
            >
              {editingTaskId ? 'Salvar Alterações' : 'Salvar Agendamento'}
            </button>
          </div>
        </form>
      )}

      {/* Scheduled Tasks List */}
      {scheduledTasks.length === 0 ? (
        <div className="rounded-2xl bg-[#121720] border border-slate-800/90 p-10 text-center space-y-2">
          <CalendarClock className="w-8 h-8 text-slate-500 mx-auto" />
          <div className="text-sm font-semibold text-slate-200">
            Nenhuma tarefa agendada ainda
          </div>
          <p className="text-xs text-slate-400">
            Clique em <strong>Nova Tarefa Agendada</strong> para programar o envio automático de relatórios PDF por e-mail.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {scheduledTasks.map((task) => {
            const langLabel =
              task.languageId === 'all'
                ? 'Todos os Idiomas'
                : langMap.get(task.languageId)?.name || task.languageId;
            const grpLabel =
              task.groupId === 'all'
                ? 'Todos os Grupos'
                : groupMap.get(task.groupId)?.name || task.groupId;
            const chLabel =
              task.channelId === 'all'
                ? 'Todos os Canais'
                : chMap.get(task.channelId)?.name || task.channelId;

            const freqLabel =
              task.frequency === 'daily'
                ? `Diário às ${task.time}`
                : task.frequency === 'weekly'
                ? `Semanal (${WEEKDAYS[task.weekday ?? 1]}) às ${task.time}`
                : task.frequency === 'monthly'
                ? `Mensal (dia ${task.monthDay ?? 1}) às ${task.time}`
                : `Único em ${task.onceDate} às ${task.time}`;

            return (
              <div
                key={task.id}
                className={`rounded-2xl p-4 border space-y-3 transition ${
                  task.isActive
                    ? 'bg-[#121720] border-slate-800/90'
                    : 'bg-[#0e131a] border-slate-800/40 opacity-65'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-sm text-white">{task.name}</h3>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <Mail className="w-3.5 h-3.5 text-orange-400" />
                      {task.toEmail}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-[#0b0f14] border border-slate-800 text-[11px] font-mono-num text-orange-300">
                    {freqLabel}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200">
                    Período: {task.period}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200">
                    {langLabel}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200">
                    {grpLabel}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200">
                    {chLabel}
                  </span>
                </div>

                {task.lastStatus && (
                  <div
                    className={`text-[11px] ${
                      task.lastStatus.startsWith('Erro')
                        ? 'text-rose-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    Última execução:{' '}
                    {task.lastRunAt
                      ? new Date(task.lastRunAt).toLocaleString('pt-BR')
                      : ''}{' '}
                    — {task.lastStatus}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-800/70">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleScheduledTask(task.id)}
                      title={task.isActive ? 'Desativar tarefa' : 'Ativar tarefa'}
                      className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        task.isActive
                          ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      {task.isActive ? 'Ativa · Desativar' : 'Desativada · Ativar'}
                    </button>

                    <button
                      onClick={() => handleRunNow(task.id)}
                      disabled={runningTaskId === task.id}
                      className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 transition cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {runningTaskId === task.id ? 'Enviando...' : 'Enviar Agora'}
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditTaskForm(task)}
                      title="Editar tarefa"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 transition cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteScheduledTask(task.id)}
                      title="Excluir tarefa"
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
      )}
    </div>
  );
}
