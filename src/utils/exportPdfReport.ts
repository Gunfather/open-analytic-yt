import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AggregatedKpis,
  Channel,
  ChannelGroup,
  DailyMetric,
  Language,
  PeriodOption,
  VideoItem,
} from '../types/youtube';
import {
  formatCurrency,
  formatDuration,
  formatHours,
  formatNumber,
} from './formatters';

export interface PdfReportSections {
  kpis: boolean;
  byLanguage: boolean;
  byChannel: boolean;
  topVideos: boolean;
  topEngagement: boolean;
  audienceDetails: boolean;
}

interface ExportReportParams {
  period: PeriodOption;
  days: number;
  selectedLanguageId: string;
  selectedGroupId: string;
  selectedChannelId: string;
  languages: Language[];
  groups: ChannelGroup[];
  filteredChannels: Channel[];
  metrics: DailyMetric[];
  videos: VideoItem[];
  kpis?: AggregatedKpis;
  sections?: PdfReportSections;
  topVideosLimit?: number;
  aiNote?: string;
  returnBase64?: boolean;
}

function cleanText(str: string): string {
  return str
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function computeKpis(
  filteredChannels: Channel[],
  metrics: DailyMetric[],
  days: number
): AggregatedKpis {
  const activeIds = new Set(filteredChannels.map((c) => c.id));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentStart = new Date(today);
  currentStart.setDate(today.getDate() - (days - 1));
  const prevStart = new Date(currentStart);
  prevStart.setDate(currentStart.getDate() - days);

  const curStartStr = currentStart.toISOString().slice(0, 10);
  const prevStartStr = prevStart.toISOString().slice(0, 10);

  let views = 0;
  let engagedViews = 0;
  let watchTimeHours = 0;
  let subscribers = 0;
  let likes = 0;
  let comments = 0;
  let shares = 0;
  let revenue = 0;
  let prevViews = 0;
  let prevWatchTime = 0;
  let prevSubs = 0;
  let prevEngagement = 0;
  let prevRevenue = 0;

  for (const m of metrics) {
    if (!activeIds.has(m.channelId)) continue;
    if (m.date >= curStartStr) {
      views += m.views;
      engagedViews += m.engagedViews;
      watchTimeHours += m.watchTimeHours;
      subscribers += m.subscribersGained;
      likes += m.likes;
      comments += m.comments;
      shares += m.shares;
      revenue += m.revenue;
    } else if (m.date >= prevStartStr && m.date < curStartStr) {
      prevViews += m.views;
      prevWatchTime += m.watchTimeHours;
      prevSubs += m.subscribersGained;
      prevEngagement += m.likes + m.comments + m.shares;
      prevRevenue += m.revenue;
    }
  }

  const engagement = likes + comments + shares;
  const pct = (c: number, p: number) => (p > 0 ? Number((((c - p) / p) * 100).toFixed(1)) : 0);
  const avgHookRate =
    filteredChannels.length > 0
      ? Number(
          (
            filteredChannels.reduce((acc, c) => acc + c.hookRate, 0) /
            filteredChannels.length
          ).toFixed(1)
        )
      : 0;
  const avgRpm = views > 0 ? Number(((revenue / views) * 1000).toFixed(2)) : 0;
  const avgCpm =
    filteredChannels.length > 0
      ? Number(
          (
            filteredChannels.reduce((acc, c) => acc + c.cpm, 0) / filteredChannels.length
          ).toFixed(2)
        )
      : 0;

  return {
    views,
    viewsDelta: views - prevViews,
    viewsDeltaPct: pct(views, prevViews),
    engagedViews,
    hookRate: avgHookRate,
    watchTimeHours: Number(watchTimeHours.toFixed(1)),
    watchTimeDeltaPct: pct(watchTimeHours, prevWatchTime),
    subscribers,
    subscribersDeltaPct: pct(subscribers, prevSubs),
    engagement,
    engagementDeltaPct: pct(engagement, prevEngagement),
    likes,
    comments,
    shares,
    revenue: Number(revenue.toFixed(2)),
    revenueDeltaPct: pct(revenue, prevRevenue),
    avgCpm,
    avgRpm,
  };
}

export function exportAiPdfReport(params: ExportReportParams): { filename: string; base64?: string } {
  const {
    period,
    days,
    selectedLanguageId,
    selectedGroupId,
    selectedChannelId,
    languages,
    groups,
    filteredChannels,
    metrics,
    videos,
    sections = {
      kpis: true,
      byLanguage: true,
      byChannel: true,
      topVideos: true,
      topEngagement: true,
      audienceDetails: true,
    },
    topVideosLimit = 15,
    aiNote,
  } = params;

  const kpis = params.kpis || computeKpis(filteredChannels, metrics, days);

  const langMap = new Map(languages.map((l) => [l.id, l]));
  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const chMap = new Map(filteredChannels.map((c) => [c.id, c]));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - (days - 1));
  const startStr = startDate.toISOString().slice(0, 10);

  const channelRows = filteredChannels
    .map((ch) => {
      let views = 0;
      let watchTime = 0;
      let subs = 0;
      let likes = 0;
      let comments = 0;
      let shares = 0;
      let revenue = 0;

      for (const m of metrics) {
        if (m.channelId === ch.id && m.date >= startStr) {
          views += m.views;
          watchTime += m.watchTimeHours;
          subs += m.subscribersGained;
          likes += m.likes;
          comments += m.comments;
          shares += m.shares;
          revenue += m.revenue;
        }
      }

      const engagement = likes + comments + shares;
      const engRate = views > 0 ? ((engagement / views) * 100).toFixed(2) : '0.00';

      return {
        ch,
        lang: langMap.get(ch.languageId),
        group: ch.groupId ? groupMap.get(ch.groupId) : undefined,
        views,
        watchTime,
        subs,
        engagement,
        engRate,
        revenue,
      };
    })
    .sort((a, b) => b.views - a.views);

  const langTotals = new Map<
    string,
    { name: string; channels: number; views: number; watchTime: number; revenue: number }
  >();
  for (const row of channelRows) {
    const key = row.ch.languageId;
    const cur = langTotals.get(key) || {
      name: row.lang ? `${row.lang.name} (${row.lang.code})` : key,
      channels: 0,
      views: 0,
      watchTime: 0,
      revenue: 0,
    };
    cur.channels += 1;
    cur.views += row.views;
    cur.watchTime += row.watchTime;
    cur.revenue += row.revenue;
    langTotals.set(key, cur);
  }

  const periodVideos = videos
    .filter((v) => chMap.has(v.channelId) && v.publishedAt >= startStr)
    .sort((a, b) => b.views - a.views);

  const topVideos = periodVideos.slice(0, topVideosLimit);
  const topLikes = [...periodVideos].sort((a, b) => b.likes - a.likes).slice(0, 5);
  const topComments = [...periodVideos].sort((a, b) => b.comments - a.comments).slice(0, 5);

  const filterLangLabel =
    selectedLanguageId === 'all'
      ? 'Todos'
      : langMap.get(selectedLanguageId)?.name || selectedLanguageId;
  const filterGroupLabel =
    selectedGroupId === 'all'
      ? 'Todos'
      : groupMap.get(selectedGroupId)?.name || selectedGroupId;
  const filterChannelLabel =
    selectedChannelId === 'all'
      ? `Todos (${filteredChannels.length})`
      : chMap.get(selectedChannelId)?.name || selectedChannelId;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const getLastY = () =>
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 32;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatorio YouTube Multi-Canal (Open Analytic YT)', 14, 16);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 90, 105);
  doc.text(
    cleanText(
      `Gerado em: ${new Date().toLocaleString('pt-BR')} | Periodo: ${period} (${days} dias) | Idioma: ${filterLangLabel} | Grupo: ${filterGroupLabel} | Canal: ${filterChannelLabel}`
    ),
    14,
    22,
    { maxWidth: 182 }
  );

  let y = 30;
  if (aiNote?.trim()) {
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    const noteLines = doc.splitTextToSize(
      cleanText(`Instrucao para IA: ${aiNote}`),
      180
    );
    doc.text(noteLines, 14, y);
    y += noteLines.length * 4 + 4;
  }

  doc.setTextColor(15, 23, 42);

  if (sections.kpis) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo Executivo (KPIs)', 14, y);

    autoTable(doc, {
      startY: y + 3,
      head: [['Metrica', 'Valor', 'Detalhe / Variacao']],
      body: [
        [
          'Total Views',
          formatNumber(kpis.views),
          `${kpis.viewsDeltaPct >= 0 ? '+' : ''}${kpis.viewsDeltaPct}% | Hook Rate: ${kpis.hookRate}%`,
        ],
        [
          'Watch Time (hrs)',
          `${formatHours(kpis.watchTimeHours)}h`,
          `${kpis.watchTimeDeltaPct >= 0 ? '+' : ''}${kpis.watchTimeDeltaPct}% vs. periodo anterior`,
        ],
        [
          'Novos Inscritos',
          `+${formatNumber(kpis.subscribers)}`,
          `${kpis.subscribersDeltaPct >= 0 ? '+' : ''}${kpis.subscribersDeltaPct}% vs. periodo anterior`,
        ],
        [
          'Engajamento Total',
          formatNumber(kpis.engagement),
          `Likes: ${formatNumber(kpis.likes)} | Comentarios: ${formatNumber(kpis.comments)} | Compart.: ${formatNumber(kpis.shares)}`,
        ],
        [
          'Receita Estimada',
          formatCurrency(kpis.revenue),
          `RPM Medio: $${kpis.avgRpm.toFixed(2)} | CPM Medio: $${kpis.avgCpm.toFixed(2)}`,
        ],
      ],
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.2 },
      headStyles: { fillColor: [249, 115, 22], textColor: 255 },
    });
    y = getLastY() + 8;
  }

  if (sections.byLanguage && langTotals.size > 0) {
    if (y > 250) {
      doc.addPage();
      y = 16;
    }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Comparativo por Idioma', 14, y);

    autoTable(doc, {
      startY: y + 3,
      head: [['Idioma', 'Canais', 'Views', 'Watch Time', 'Receita', 'RPM Medio']],
      body: Array.from(langTotals.values())
        .sort((a, b) => b.views - a.views)
        .map((l) => [
          cleanText(l.name),
          String(l.channels),
          formatNumber(l.views),
          `${formatHours(l.watchTime)}h`,
          formatCurrency(l.revenue),
          formatCurrency(l.views > 0 ? (l.revenue / l.views) * 1000 : 0),
        ]),
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.2 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    });
    y = getLastY() + 8;
  }

  if (sections.byChannel && channelRows.length > 0) {
    if (y > 245) {
      doc.addPage();
      y = 16;
    }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Desempenho por Canal', 14, y);

    autoTable(doc, {
      startY: y + 3,
      head: [['Canal', 'Idioma', 'Grupo', 'Inscritos', 'Views', 'CTR', 'Engaj.', 'Receita']],
      body: channelRows.map((r) => [
        cleanText(`${r.ch.name} (${r.ch.handle})`),
        r.lang?.code || r.ch.languageId,
        cleanText(r.group?.name || '-'),
        formatNumber(r.ch.subscribersTotal),
        formatNumber(r.views),
        `${(r.ch.ctr ?? 6.2).toFixed(1)}%`,
        `${formatNumber(r.engagement)} (${r.engRate}%)`,
        formatCurrency(r.revenue),
      ]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    });
    y = getLastY() + 8;
  }

  if (sections.topVideos && topVideos.length > 0) {
    if (y > 245) {
      doc.addPage();
      y = 16;
    }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Top ${topVideos.length} Videos por Visualizacoes (${period})`, 14, y);

    autoTable(doc, {
      startY: y + 3,
      head: [['#', 'Titulo', 'Canal', 'Data', 'Duracao', 'Views', 'Likes', 'Coment.']],
      body: topVideos.map((v, i) => [
        String(i + 1),
        cleanText(`${v.title}${v.isShort ? ' [SHORT]' : ''}`),
        cleanText(chMap.get(v.channelId)?.name || ''),
        v.publishedAt,
        formatDuration(v.durationSec),
        formatNumber(v.views),
        formatNumber(v.likes),
        formatNumber(v.comments),
      ]),
      theme: 'grid',
      styles: { fontSize: 7.8, cellPadding: 1.8 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      columnStyles: { 1: { cellWidth: 62 } },
    });
    y = getLastY() + 8;
  }

  if (sections.topEngagement && topLikes.length > 0) {
    if (y > 245) {
      doc.addPage();
      y = 16;
    }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Top 5 Likes & Top 5 Comentarios', 14, y);

    autoTable(doc, {
      startY: y + 3,
      head: [['Ranking', 'Titulo', 'Likes', 'Comentarios', 'Views']],
      body: [
        ...topLikes.map((v, i) => [
          `Like #${i + 1}`,
          cleanText(v.title),
          formatNumber(v.likes),
          formatNumber(v.comments),
          formatNumber(v.views),
        ]),
        ...topComments.map((v, i) => [
          `Coment. #${i + 1}`,
          cleanText(v.title),
          formatNumber(v.likes),
          formatNumber(v.comments),
          formatNumber(v.views),
        ]),
      ],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      columnStyles: { 1: { cellWidth: 80 } },
    });
    y = getLastY() + 8;
  }

  if (sections.audienceDetails && filteredChannels.length > 0) {
    if (y > 235) {
      doc.addPage();
      y = 16;
    }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Audiencia, Dispositivos, Origens e Demografia (Media Ponderada)', 14, y);

    let totalW = 0;
    let mobile = 0;
    let desktop = 0;
    let tv = 0;
    let tablet = 0;
    let search = 0;
    let browse = 0;
    let suggested = 0;
    let shorts = 0;
    let female = 0;
    let male = 0;

    for (const ch of filteredChannels) {
      const w = Math.max(1, ch.viewsTotal || 1);
      totalW += w;
      const dt = ch.deviceTypes || { mobile: 70.4, desktop: 13.2, tv: 12.2, tablet: 4.2 };
      const ts = ch.trafficSources || { search: 57, browse: 13, suggested: 13, shorts: 10, other: 7 };
      const gb = ch.genderBreakdown || { female: 14.3, male: 85.7, custom: 0 };
      mobile += dt.mobile * w;
      desktop += dt.desktop * w;
      tv += dt.tv * w;
      tablet += dt.tablet * w;
      search += ts.search * w;
      browse += ts.browse * w;
      suggested += ts.suggested * w;
      shorts += ts.shorts * w;
      female += gb.female * w;
      male += gb.male * w;
    }

    autoTable(doc, {
      startY: y + 3,
      head: [['Categoria', 'Detalhamento']],
      body: [
        [
          'Origens de Trafego',
          `Pesquisa: ${Math.round(search / totalW)}% | Navegacao: ${Math.round(browse / totalW)}% | Sugeridos: ${Math.round(suggested / totalW)}% | Shorts: ${Math.round(shorts / totalW)}%`,
        ],
        [
          'Tipo de Dispositivo',
          `Telemovel: ${(mobile / totalW).toFixed(1)}% | Computador: ${(desktop / totalW).toFixed(1)}% | TV: ${(tv / totalW).toFixed(1)}% | Tablet: ${(tablet / totalW).toFixed(1)}%`,
        ],
        [
          'Genero',
          `Masculino: ${(male / totalW).toFixed(1)}% | Feminino: ${(female / totalW).toFixed(1)}%`,
        ],
      ],
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.2 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    });
  }

  const filename = `OpenAnalyticYT-Relatorio-${period}-${new Date().toISOString().slice(0, 10)}.pdf`;
  if (params.returnBase64) {
    const dataUri = doc.output('datauristring');
    const base64 = dataUri.split(',')[1] || '';
    return { filename, base64 };
  }
  doc.save(filename);
  return { filename };
}
