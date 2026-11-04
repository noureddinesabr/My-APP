// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dueDate, invoiceNumber, invoiceState, offersPaused, shareOf, totals, weekKey, weekRange, weekStart, weeksToInvoice } from './invoices.ts';

const DAY = 86_400_000;
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const terms = { dueDays: 7, graceDays: 7 };

test('weeks start on Monday', () => {
  // Wed 4 Nov 2026 → Mon 2 Nov
  assert.equal(weekKey(at(2026, 11, 4)), '2026-11-02');
  assert.equal(weekKey(at(2026, 11, 2, 0)), '2026-11-02');
  // Sunday belongs to the week before
  assert.equal(weekKey(at(2026, 11, 8, 23)), '2026-11-02');
  assert.equal(weekKey(at(2026, 11, 9, 0)), '2026-11-09');
  assert.equal(weekStart(at(2026, 11, 4)), new Date(2026, 10, 2).getTime());
  const { start, end } = weekRange('2026-11-02');
  assert.equal(end - start, 7 * DAY);
});

test('share is rounded to whole dirhams and totals add up', () => {
  assert.equal(shareOf(455, 0.1), 46);
  assert.deepEqual(totals([{ price: 400, share: 40 }, { price: 250, share: 25 }]), { price: 650, share: 65 });
});

test('only finished weeks are invoiced, oldest first', () => {
  const jobs = [
    { id: 'a', price: 400, share: 40, completedAt: at(2026, 10, 27) },
    { id: 'b', price: 300, share: 30, completedAt: at(2026, 11, 3) },
    { id: 'c', price: 200, share: 20, completedAt: at(2026, 10, 20) },
    { id: 'd', price: 100, share: 10, completedAt: at(2026, 10, 28) },
  ];
  const now = at(2026, 11, 4);
  const weeks = weeksToInvoice(jobs, now);
  assert.deepEqual(weeks.map((w) => w.week), ['2026-10-19', '2026-10-26']);
  assert.deepEqual(weeks[1].jobs.map((j) => j.id), ['a', 'd']);
  // Test mode can close the current week early.
  assert.deepEqual(weeksToInvoice(jobs, now, true).map((w) => w.week), ['2026-10-19', '2026-10-26', '2026-11-02']);
});

test('due a week after the week ends, offers pause after the grace days', () => {
  const due = dueDate('2026-10-26', terms);
  assert.equal(due, new Date(2026, 10, 9).getTime() - 1);
  const invoice = { status: 'open' as const, dueAt: due };
  assert.equal(invoiceState(invoice, due - DAY, terms), 'due');
  assert.equal(invoiceState(invoice, due + DAY, terms), 'overdue');
  assert.equal(invoiceState(invoice, due + 8 * DAY, terms), 'paused');
  assert.equal(offersPaused([invoice], due + 8 * DAY, terms), true);
  // A reported payment counts until the company says it didn't arrive.
  assert.equal(offersPaused([{ ...invoice, status: 'paymentSent' }], due + 30 * DAY, terms), false);
  assert.equal(invoiceState({ ...invoice, status: 'paid' }, due + 30 * DAY, terms), 'paid');
});

test('invoice numbers are readable and stable', () => {
  assert.equal(invoiceNumber('2026-10-26', 'd_abc123xyz'), 'XA-20261026-23XYZ');
  assert.equal(invoiceNumber('2026-10-26', 'd_abc123xyz', 2), 'XA-20261026-23XYZ-2');
});
