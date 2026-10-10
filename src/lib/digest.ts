import { endOfDay, startOfDay, subDays, subMonths } from 'date-fns';
import type { PageviewMetricsData, WebsiteStatsData } from '@/queries/sql';

export const DIGEST_PERIODS = ['day', 'week', 'month'] as const;

export type DigestPeriod = (typeof DIGEST_PERIODS)[number];

export interface DigestMetric {
  value: number;
  previous: number;
  change: number;
}

export interface WebsiteDigest {
  websiteId: string;
  name: string;
  domain: string;
  period: DigestPeriod;
  startDate: Date;
  endDate: Date;
  visitors: DigestMetric;
  visits: DigestMetric;
  pageviews: DigestMetric;
  bounceRate: DigestMetric;
  visitDuration: DigestMetric;
  topPages: PageviewMetricsData[];
  topReferrers: PageviewMetricsData[];
}

const EMPTY_STATS: WebsiteStatsData = {
  pageviews: 0,
  visitors: 0,
  visits: 0,
  bounces: 0,
  totaltime: 0,
};

/**
 * Returns the date range covered by a digest, ending at the end of yesterday so
 * a digest sent in the morning never includes a partial day.
 */
export function getDigestRange(period: DigestPeriod, now = new Date()) {
  const endDate = endOfDay(subDays(now, 1));

  switch (period) {
    case 'day':
      return { startDate: startOfDay(endDate), endDate };
    case 'month':
      return { startDate: startOfDay(subMonths(endDate, 1)), endDate };
    default:
      return { startDate: startOfDay(subDays(endDate, 6)), endDate };
  }
}

/**
 * Returns the period of equal length immediately before the given range.
 */
export function getPreviousPeriod(startDate: Date, endDate: Date) {
  const length = endDate.getTime() - startDate.getTime();

  return {
    startDate: new Date(startDate.getTime() - length),
    endDate: new Date(endDate.getTime() - length),
  };
}

export function percentChange(current: number, previous: number) {
  if (!previous) {
    return current > 0 ? 100 : 0;
  }

  return Math.round(((current - previous) / previous) * 100);
}

export function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;

  if (minutes === 0) {
    return `${secs}s`;
  }

  return secs === 0 ? `${minutes}m` : `${minutes}m ${secs}s`;
}

export function formatCompact(value: number) {
  const n = Number(value) || 0;

  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}m`;
  }

  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}k`;
  }

  return n.toString();
}

function toMetric(value: number, previous: number): DigestMetric {
  return { value, previous, change: percentChange(value, previous) };
}

function firstRow(rows: WebsiteStatsData[] | undefined): WebsiteStatsData {
  return rows?.[0] ?? EMPTY_STATS;
}

export function buildDigest({
  website,
  period,
  startDate,
  endDate,
  current,
  previous,
  topPages,
  topReferrers,
}: {
  website: { id: string; name: string; domain?: string | null };
  period: DigestPeriod;
  startDate: Date;
  endDate: Date;
  current: WebsiteStatsData[];
  previous: WebsiteStatsData[];
  topPages: PageviewMetricsData[];
  topReferrers: PageviewMetricsData[];
}): WebsiteDigest {
  const now = firstRow(current);
  const prev = firstRow(previous);

  const bounceRate = (stats: WebsiteStatsData) =>
    stats.visitors ? Math.round((stats.bounces / stats.visitors) * 100) : 0;

  const visitDuration = (stats: WebsiteStatsData) =>
    stats.visits ? stats.totaltime / stats.visits : 0;

  return {
    websiteId: website.id,
    name: website.name,
    domain: website.domain ?? '',
    period,
    startDate,
    endDate,
    visitors: toMetric(Number(now.visitors), Number(prev.visitors)),
    visits: toMetric(Number(now.visits), Number(prev.visits)),
    pageviews: toMetric(Number(now.pageviews), Number(prev.pageviews)),
    bounceRate: toMetric(bounceRate(now), bounceRate(prev)),
    visitDuration: toMetric(visitDuration(now), visitDuration(prev)),
    topPages,
    topReferrers,
  };
}

function formatChange(change: number) {
  if (change === 0) {
    return '±0%';
  }

  return change > 0 ? `▲ ${change}%` : `▼ ${Math.abs(change)}%`;
}

function formatRange(startDate: Date, endDate: Date) {
  const format = (date: Date) => date.toISOString().slice(0, 10);

  return `${format(startDate)} – ${format(endDate)}`;
}

/**
 * Renders a digest as Markdown, suitable for Slack or email.
 */
export function formatDigestMarkdown(digest: WebsiteDigest) {
  const lines = [
    `*${digest.name}* (${digest.domain}) — ${formatRange(digest.startDate, digest.endDate)}`,
    '',
    `• Visitors: *${formatCompact(digest.visitors.value)}* ${formatChange(digest.visitors.change)}`,
    `• Visits: *${formatCompact(digest.visits.value)}* ${formatChange(digest.visits.change)}`,
    `• Views: *${formatCompact(digest.pageviews.value)}* ${formatChange(digest.pageviews.change)}`,
    `• Bounce rate: *${digest.bounceRate.value}%* ${formatChange(digest.bounceRate.change)}`,
    `• Visit duration: *${formatDuration(digest.visitDuration.value)}* ${formatChange(digest.visitDuration.change)}`,
  ];

  if (digest.topPages.length) {
    lines.push('', '*Top pages*');
    digest.topPages.forEach(({ x, y }, i) => {
      lines.push(`${i + 1}. \`${x}\` — ${formatCompact(y)}`);
    });
  }

  if (digest.topReferrers.length) {
    lines.push('', '*Top referrers*');
    digest.topReferrers.forEach(({ x, y }, i) => {
      lines.push(`${i + 1}. ${x || '(direct)'} — ${formatCompact(y)}`);
    });
  }

  return lines.join('\n');
}

/**
 * Renders a digest as plain text, for clients that do not support Markdown.
 */
export function formatDigestText(digest: WebsiteDigest) {
  return formatDigestMarkdown(digest)
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/•/g, '-');
}
