import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { VehicleType } from '../models/booking';
import smallVan from '../assets/vehicles/smallVan.webp';
import largeVan from '../assets/vehicles/largeVan.webp';
import pickup from '../assets/vehicles/pickup.webp';
import truck35 from '../assets/vehicles/truck35.webp';
import truck7 from '../assets/vehicles/truck7.webp';
import triporteur from '../assets/vehicles/triporteur.webp';
import cityTruck from '../assets/vehicles/cityTruck.webp';
import refrigerated from '../assets/vehicles/refrigerated.webp';

export const VEHICLE_IMG: Record<VehicleType, string> = { smallVan, largeVan, pickup, truck35, truck7, triporteur, cityTruck, refrigerated };

export const spring = { type: 'spring', stiffness: 420, damping: 34 } as const;

/** Bottom sheet over the current screen (map stays visible behind it). */
export function Sheet({ open, onClose, children, title, height = 'auto', label }: { open: boolean; onClose: () => void; children: ReactNode; title?: ReactNode; height?: string; label?: string }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center sm:items-center" role="dialog" aria-modal aria-label={label}>
          <motion.div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="glass-strong relative flex w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] shadow-card sm:rounded-[28px]"
            style={{ maxHeight: '88dvh', height }}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={spring}
          >
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
            {title !== undefined && (
              <div className="flex items-center gap-2 px-5 pb-1 pt-3">
                <div className="min-w-0 flex-1 font-display text-[17px] font-semibold">{title}</div>
                <button className="icon-btn -me-2" onClick={onClose} aria-label="close">
                  <X size={20} />
                </button>
              </div>
            )}
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/** Illustrated driver portrait (sample drivers have no real photos). */
export function DriverAvatar({ name, hue, size = 48 }: { name: string; hue: number; size?: number }) {
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('');
  return (
    <div className="relative shrink-0 overflow-hidden rounded-full ring-1 ring-white/15" style={{ width: size, height: size, background: `linear-gradient(140deg, hsl(${hue} 70% 62%), hsl(${(hue + 50) % 360} 70% 38%))` }}>
      <svg viewBox="0 0 48 48" className="absolute inset-0 h-full w-full opacity-35" aria-hidden>
        <circle cx="24" cy="19" r="9" fill="white" />
        <path d="M6 48c2-11 9.5-16 18-16s16 5 18 16z" fill="white" />
      </svg>
      <div className="absolute inset-0 grid place-items-center font-display font-bold text-white" style={{ fontSize: size * 0.34, textShadow: '0 1px 6px rgba(0,0,0,.35)' }}>
        {initials}
      </div>
    </div>
  );
}

export function Stars({ value, size = 13 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 font-semibold text-amber-300" style={{ fontSize: size }}>
      ★ <span className="text-mist-100">{value.toFixed(1)}</span>
    </span>
  );
}

export function ModeBadge({ demo, label, onClick }: { demo: boolean; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`tag ${demo ? 'bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/25' : 'bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/25'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${demo ? 'bg-amber-300' : 'bg-cyan-300'}`} />
      {label}
    </button>
  );
}

export function Toast({ text, onClose }: { text: string | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {text && (
        <motion.div className="fixed inset-x-4 top-4 z-[1100] mx-auto max-w-md" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}>
          <button onClick={onClose} className="glass-strong w-full rounded-2xl px-4 py-3 text-start text-[13.5px] text-mist-100 shadow-card">
            {text}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
