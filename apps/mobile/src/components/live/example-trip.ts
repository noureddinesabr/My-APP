import { useEffect, useRef } from 'react';

import { advanceJob, handOver, moveDriver, takeTrip } from '@/backend/actions';
import { useStore } from '@/backend';
import { isExample } from '@/backend/examples';
import type { Job, JobStatus } from '@/backend/types';
import { autoStatus, remaining, simulatedStart, simulateStep, simulationTarget } from '@/lib/trip';

const TICK_MS = 2000;
/** The example driver stays this long at the pickup, so the helpers question can be answered. */
const LOADING_MS = 25_000;
/** At the destination, he unloads for a moment and then hands over. */
const UNLOADING_MS = 8_000;

/**
 * Test version: a trip with an example driver moves on by itself on the customer's phone
 * (drive to the pickup, load, drive, unload, «Handed over»), with the same steps, chat lines
 * and automatic messages as a real driver. Real drivers drive their own trips.
 */
export function useExampleTrip(job: Job | null) {
  const store = useStore();
  const latest = useRef(job);
  const advancing = useRef<JobStatus | null>(null);
  useEffect(() => {
    latest.current = job;
  }, [job]);
  const example = !!job && isExample(job.driverId);
  const status = job?.status;
  const moving = example && (status === 'toPickup' || status === 'atPickup' || status === 'loading' || status === 'inTransit');

  // A booking: the example driver confirms «I take this trip» after a moment.
  useEffect(() => {
    if (!example || status !== 'scheduled' || latest.current?.takenAt) return;
    const timer = setTimeout(() => latest.current && takeTrip(store, latest.current).catch(() => {}), 3000);
    return () => clearTimeout(timer);
  }, [example, status, store]);

  // At the destination: unload, then hand over.
  useEffect(() => {
    if (!example || status !== 'atDropoff') return;
    const timer = setTimeout(() => latest.current && handOver(store, latest.current).catch(() => {}), UNLOADING_MS);
    return () => clearTimeout(timer);
  }, [example, status, store]);

  // Driving: one step every 2 seconds; the steps follow from the position, like GPS.
  useEffect(() => {
    if (!moving) return;
    let legKm = 0;
    let legTarget = '';
    const timer = setInterval(() => {
      const current = latest.current;
      if (!current) return;
      if (!current.driverPos) {
        moveDriver(store, current.id, simulatedStart(current.from, current.from), true).catch(() => {});
        return;
      }
      const now = Date.now();
      const target = simulationTarget(current.status, current.from, current.to, current.timeline.atPickup ?? current.timeline.loading, now, LOADING_MS);
      if (target) {
        const key = `${target.lat},${target.lng}`;
        if (key !== legTarget) {
          legTarget = key;
          legKm = remaining(current.driverPos, target).km;
        }
        const next = simulateStep(current.driverPos, target, legKm, TICK_MS / 1000);
        if (next.lat !== current.driverPos.lat || next.lng !== current.driverPos.lng) moveDriver(store, current.id, next, true).catch(() => {});
      }
      const step = autoStatus(current.status, current.driverPos, current.from, current.to);
      if (step && advancing.current !== step) {
        advancing.current = step;
        advanceJob(store, current, step).catch(() => {});
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [moving, store]);
}
