import { z } from 'zod';
import {
  buildDigest,
  formatDigestMarkdown,
  getDigestRange,
  getPreviousPeriod,
} from '@/lib/digest';
import { parseRequest } from '@/lib/request';
import { json, notFound, unauthorized } from '@/lib/response';
import { canViewWebsite } from '@/permissions';
import { getWebsite } from '@/queries/prisma';
import { getPageviewMetrics, getWebsiteStats } from '@/queries/sql';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const schema = z.object({
    period: z.enum(['day', 'week', 'month']).default('week'),
    timezone: z.string().optional(),
    format: z.enum(['json', 'markdown']).default('json'),
    limit: z.coerce.number().int().min(1).max(20).default(5),
  });

  const { auth, query, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const { websiteId } = await params;

  if (!(await canViewWebsite(auth, websiteId))) {
    return unauthorized();
  }

  const website = await getWebsite(websiteId);

  if (!website) {
    return notFound();
  }

  const { period, timezone = 'UTC', format, limit } = query;
  const { startDate, endDate } = getDigestRange(period);
  const previousPeriod = getPreviousPeriod(startDate, endDate);

  const filters = { startDate, endDate, timezone, unit: 'day' };

  const [current, previous, topPages, topReferrers] = await Promise.all([
    getWebsiteStats(websiteId, filters),
    getWebsiteStats(websiteId, { ...filters, ...previousPeriod }),
    getPageviewMetrics(websiteId, { type: 'path', limit }, filters),
    getPageviewMetrics(websiteId, { type: 'referrer', limit }, filters),
  ]);

  const digest = buildDigest({
    website,
    period,
    startDate,
    endDate,
    current,
    previous,
    topPages,
    topReferrers,
  });

  if (format === 'markdown') {
    return new Response(formatDigestMarkdown(digest), {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  }

  return json(digest);
}
