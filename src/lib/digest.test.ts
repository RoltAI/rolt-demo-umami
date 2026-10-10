import { expect, test } from 'vitest';
import * as digest from './digest';

test('getDigestRange ends at the end of yesterday', () => {
  const now = new Date(2025, 5, 15, 9, 30);
  const { startDate, endDate } = digest.getDigestRange('week', now);

  expect(endDate.getDate()).toBe(14);
  expect(endDate.getHours()).toBe(23);
  expect(startDate.getDate()).toBe(8);
  expect(startDate.getHours()).toBe(0);
});

test('getDigestRange for a single day', () => {
  const now = new Date(2025, 5, 15, 9, 30);
  const { startDate, endDate } = digest.getDigestRange('day', now);

  expect(startDate.getDate()).toBe(14);
  expect(endDate.getDate()).toBe(14);
});

test('getPreviousPeriod returns a range of equal length', () => {
  const startDate = new Date('2025-06-08T00:00:00Z');
  const endDate = new Date('2025-06-15T00:00:00Z');
  const previous = digest.getPreviousPeriod(startDate, endDate);

  expect(previous.startDate.toISOString()).toBe('2025-06-01T00:00:00.000Z');
  expect(previous.endDate.toISOString()).toBe('2025-06-08T00:00:00.000Z');
});

test('percentChange', () => {
  expect(digest.percentChange(150, 100)).toBe(50);
  expect(digest.percentChange(50, 100)).toBe(-50);
  expect(digest.percentChange(10, 0)).toBe(100);
  expect(digest.percentChange(0, 0)).toBe(0);
});

test('formatDuration', () => {
  expect(digest.formatDuration(0)).toBe('0s');
  expect(digest.formatDuration(45)).toBe('45s');
  expect(digest.formatDuration(120)).toBe('2m');
  expect(digest.formatDuration(125.4)).toBe('2m 5s');
});

test('formatCompact', () => {
  expect(digest.formatCompact(999)).toBe('999');
  expect(digest.formatCompact(1500)).toBe('1.5k');
  expect(digest.formatCompact(2_300_000)).toBe('2.3m');
});

test('formatDigestMarkdown renders top pages and referrers', () => {
  const metric = { value: 10, previous: 5, change: 100 };
  const text = digest.formatDigestMarkdown({
    websiteId: 'w1',
    name: 'Example',
    domain: 'example.com',
    period: 'week',
    startDate: new Date('2025-06-08T00:00:00Z'),
    endDate: new Date('2025-06-14T23:59:59Z'),
    visitors: metric,
    visits: metric,
    pageviews: metric,
    bounceRate: { value: 40, previous: 40, change: 0 },
    visitDuration: { value: 95, previous: 90, change: 6 },
    topPages: [{ x: '/pricing', y: 1200 }],
    topReferrers: [{ x: '', y: 300 }],
  });

  expect(text).toContain('*Example* (example.com) — 2025-06-08 – 2025-06-14');
  expect(text).toContain('• Visit duration: *1m 35s* ▲ 6%');
  expect(text).toContain('1. `/pricing` — 1.2k');
  expect(text).toContain('1. (direct) — 300');
});
