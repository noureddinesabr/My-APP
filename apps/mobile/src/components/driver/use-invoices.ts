import { useEffect, useEffectEvent, useState } from 'react';

import { issueInvoices, normalizeJob, unbilledJobs } from '@/backend/actions';
import { useQuery, useStore } from '@/backend';
import type { DriverRecord } from '@/backend/types';
import { useCompany } from '@/components/use-company';
import { offersPaused, totals, weekKey } from '@/lib/invoices';

const HOUR = 60 * 60 * 1000;

/**
 * The driver's weekly invoices and what this week adds up to so far. Finished weeks are
 * invoiced as soon as the app is open after Sunday midnight (and checked every hour).
 */
export function useDriverInvoices(driver: Pick<DriverRecord, 'id' | 'name' | 'phone'> | null | undefined, issue = false) {
  const store = useStore();
  const { company } = useCompany();
  const raw = useQuery('jobs', driver ? [['driverId', driver.id]] : null);
  const invoices = useQuery('invoices', driver ? [['driverId', driver.id]] : null);
  const jobs = raw?.map(normalizeJob);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), HOUR);
    return () => clearInterval(timer);
  }, []);

  const runIssue = useEffectEvent(() => {
    if (!driver || !jobs || !invoices) return;
    const due = unbilledJobs(jobs).some((job) => weekKey(job.timeline.completed ?? job.createdAt) < weekKey(Date.now()));
    if (due) issueInvoices(store, driver, jobs).catch(() => {});
  });
  const ready = !!driver && !!jobs && !!invoices;
  const unbilledKey = jobs ? unbilledJobs(jobs).map((job) => job.id).join(',') : '';
  useEffect(() => {
    if (issue && ready) runIssue();
  }, [issue, ready, unbilledKey, now]);

  const thisWeek = jobs ? unbilledJobs(jobs).filter((job) => weekKey(job.timeline.completed ?? job.createdAt) === weekKey(now)) : [];
  const week = totals(thisWeek.map((job) => ({ price: job.price, share: job.commission })));
  const list = [...(invoices ?? [])].sort((a, b) => (a.week === b.week ? b.issuedAt - a.issuedAt : a.week < b.week ? 1 : -1));
  const unpaid = list.filter((invoice) => invoice.status !== 'paid');
  return {
    loaded: !!invoices && !!jobs,
    invoices: list,
    unpaid,
    owed: unpaid.reduce((sum, invoice) => sum + invoice.totalShare, 0),
    thisWeek: { trips: thisWeek.length, share: week.share, price: week.price, jobs: thisWeek },
    paused: offersPaused(list, now, company),
    company,
    now,
  };
}
