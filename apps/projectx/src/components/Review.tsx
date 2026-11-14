import { CalendarClock, MapPin, Package, Pencil, Snowflake, Truck, Users, Wine, StickyNote } from 'lucide-react';
import type { ReactNode } from 'react';
import { itemsText, whenText } from '../ai/providers/demo/brain';
import { requiredMissing, type Booking, type Lang, type Need, type Stop, type UiLang } from '../models/booking';
import { priceRange, VEHICLES } from '../models/catalog';
import { placeName, roadKm } from '../models/places';
import { tr, type UiKey } from '../i18n/ui';
import { VEHICLE_IMG } from './ui';

const asLang = (ui: UiLang): Lang => (ui === 'ar' ? 'darija' : ui);

export function stopText(s: Stop | null, ui: UiLang) {
  if (!s) return '—';
  const name = placeName(s, asLang(ui));
  if (s.floor == null) return name;
  const f = s.floor === 0 ? tr(ui, 'ground') : tr(ui, 'floor', { n: s.floor });
  const e = s.floor > 0 && s.elevator != null ? ` · ${tr(ui, s.elevator ? 'elevator' : 'noElevator')}` : '';
  return `${name} · ${f}${e}`;
}

export function helpText(b: Booking, ui: UiLang) {
  const a = b.assistance;
  if (a.loading == null && a.unloading == null) return '—';
  if (!a.loading && !a.unloading) return tr(ui, 'noHelp');
  const kind = a.loading && a.unloading ? tr(ui, 'loadUnload') : a.loading ? tr(ui, 'loadOnly') : tr(ui, 'unloadOnly');
  return a.helpers ? `${kind} · ${tr(ui, 'helpers', { n: a.helpers })}` : kind;
}

export function cargoText(b: Booking, ui: UiLang) {
  const lang = asLang(ui);
  const items = b.cargo.items.length ? itemsText(b.cargo.items, lang) : b.cargo.description ?? '—';
  const w = b.cargo.estimated_weight_kg != null ? ` · ≈${b.cargo.estimated_weight_kg} kg${b.cargo.weight_source === 'estimate' ? ` (${tr(ui, 'estimate')})` : ''}` : '';
  return `${items}${w}`;
}

const MISSING_KEY: Partial<Record<Need, UiKey>> = { cargo: 'mCargo', pickup: 'mPickup', destination: 'mDest', weight: 'mWeight', quantity: 'mQty', schedule: 'mWhen', assistance: 'mHelp', temperature: 'mTemp' };

function Row({ icon, label, value, onEdit, testid }: { icon: ReactNode; label: string; value: ReactNode; onEdit?: () => void; testid?: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5" data-testid={testid}>
      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-500/12 text-violet-200 ring-1 ring-violet-300/15">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="label">{label}</div>
        <div className="mt-0.5 text-[14.5px] leading-snug text-mist-100" dir="auto">
          {value}
        </div>
      </div>
      {onEdit && (
        <button className="icon-btn h-9 w-9 text-mist-400 hover:text-white" onClick={onEdit} aria-label={`change ${label}`}>
          <Pencil size={15} />
        </button>
      )}
    </div>
  );
}

/** The structured request, readable at a glance. Tapping ✎ asks the assistant to change that part. */
export function BookingSummary({ b, ui, now, onEdit, compact = false }: { b: Booking; ui: UiLang; now: Date; onEdit?: (k: UiKey) => void; compact?: boolean }) {
  const km = roadKm(b.pickup, b.destination);
  const pr = b.pickup && b.destination && (b.cargo.items.length || b.cargo.estimated_weight_kg) ? priceRange(b, km) : null;
  const v = b.vehicle.required ?? b.vehicle.suggested;
  const flags = [b.cargo.fragile && tr(ui, 'fragile'), b.cargo.temperature_control && tr(ui, 'cold'), b.cargo.special_handling === 'Refrigerator must stay upright' ? tr(ui, 'upright') : b.cargo.special_handling].filter(Boolean) as string[];
  const save = b.shared_transport_accepted || b.return_trip_accepted ? [b.shared_transport_accepted && tr(ui, 'shared'), b.return_trip_accepted && tr(ui, 'returnTrip')].filter(Boolean).join(' · ') : b.shared_transport_accepted === false ? tr(ui, 'privateOnly') : null;
  const edit = (k: UiKey) => (onEdit ? () => onEdit(k) : undefined);
  return (
    <div className="divide-y divide-white/[.06]">
      <Row testid="sum-cargo" icon={<Package size={16} />} label={tr(ui, 'rCargo')} onEdit={edit('rCargo')} value={<>
        {cargoText(b, ui)}
        {flags.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{flags.map((f) => <span key={f} className="tag bg-white/8 text-mist-200 ring-1 ring-white/10">{f === tr(ui, 'cold') ? <Snowflake size={11} /> : <Wine size={11} />}{f}</span>)}</div>}
      </>} />
      <Row testid="sum-route" icon={<MapPin size={16} />} label={tr(ui, 'rRoute')} onEdit={edit('rRoute')} value={<>
        <div>{stopText(b.pickup, ui)}</div>
        <div className="text-mist-300">→ {stopText(b.destination, ui)}{km ? <span className="text-mist-400"> · {tr(ui, 'km', { n: km })}</span> : null}</div>
      </>} />
      <Row testid="sum-when" icon={<CalendarClock size={16} />} label={tr(ui, 'rWhen')} onEdit={edit('rWhen')} value={b.schedule.mode ? whenText(b, asLang(ui), now) : '—'} />
      <Row testid="sum-help" icon={<Users size={16} />} label={tr(ui, 'rHelp')} onEdit={edit('rHelp')} value={<>
        {helpText(b, ui)}
        {b.passengers.accompany != null && <div className="text-mist-300">{tr(ui, 'rPeople')}: {b.passengers.count ? tr(ui, 'people', { n: b.passengers.count }) : tr(ui, 'nobody')}</div>}
        {save && <div className="text-mist-300">{save}</div>}
      </>} />
      {!compact && v && (
        <Row icon={<Truck size={16} />} label={pr ? `${tr(ui, 'rVehicle')} · ${tr(ui, 'rPrice')}` : tr(ui, 'rVehicle')} value={
          <div className="flex items-center gap-3">
            <img src={VEHICLE_IMG[v]} alt="" className="h-10 w-16 object-contain" />
            <div>
              <div>{VEHICLES[v].label[ui]}</div>
              {pr && <div className="font-display text-[15px] font-semibold text-cyan-200" dir="ltr">{pr.low}–{pr.high} MAD</div>}
            </div>
          </div>
        } />
      )}
      {b.instructions ? <Row icon={<StickyNote size={16} />} label={tr(ui, 'rNotes')} onEdit={edit('rNotes')} value={b.instructions} /> : null}
    </div>
  );
}

export function MissingLine({ b, ui }: { b: Booking; ui: UiLang }) {
  const m = requiredMissing(b).map((k) => MISSING_KEY[k]).filter(Boolean) as UiKey[];
  if (!m.length) return null;
  return <div className="rounded-xl bg-white/5 px-3 py-2 text-[13px] text-mist-300">{tr(ui, 'missing', { x: m.map((k) => tr(ui, k)).join(', ') })}</div>;
}

export function progressOf(b: Booking) {
  const total = 6;
  const missing = requiredMissing(b).filter((k) => k !== 'temperature' && k !== 'same_place').length;
  return { done: Math.max(0, total - missing), total };
}
