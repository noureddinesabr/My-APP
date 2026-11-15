import { AirVent, Armchair, Bed, Bike, Boxes, BrickWall, Briefcase, Cog, CookingPot, House, Lamp, Package, Piano, Refrigerator, Snowflake, Sofa, Table, Tv, WashingMachine, type LucideIcon } from 'lucide-react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { itemLabel } from '../models/catalog';
import type { CargoItem, Lang, UiLang } from '../models/booking';

export const ICON: Record<string, LucideIcon> = {
  fridge: Refrigerator, freezer: Snowflake, washer: WashingMachine, cooker: CookingPot, tv: Tv, ac: AirVent, appliance: WashingMachine,
  sofa: Sofa, bed: Bed, mattress: Bed, wardrobe: Armchair, table: Table, chair: Armchair, desk: Briefcase, piano: Piano, meuble: Lamp,
  boxes: Package, home_move: House, cement: BrickWall, bricks: BrickWall, sand: BrickWall, rebar: BrickWall, tiles: BrickWall, materials: BrickWall,
  pallets: Boxes, goods: Boxes, produce: Snowflake, cold_food: Snowflake, machine: Cog, motorbike: Bike,
};
export const iconOf = (k: string) => ICON[k] ?? Package;
export const langOf = (ui: UiLang): Lang => (ui === 'ar' ? 'darija' : ui);
export const nameOf = (it: CargoItem, ui: UiLang) => {
  const l = itemLabel(it.key, langOf(ui), it.label);
  return l.charAt(0).toUpperCase() + l.slice(1);
};

/** Quick picks shown as tiles when there's no photo (or to add something). */
export const PICKS = ['home_move', 'sofa', 'fridge', 'washer', 'bed', 'wardrobe', 'table', 'tv', 'boxes', 'goods', 'cement', 'machine'];

export function Stepper({ value, onChange, min = 0, max = 99 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-[#F3F3F3] p-1" dir="ltr">
      <button className="grid h-9 w-9 place-items-center rounded-full text-mist-200 hover:bg-white/10 active:scale-90 disabled:opacity-30" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label="less">
        {value <= 1 && min === 0 ? <Trash2 size={15} /> : <Minus size={16} />}
      </button>
      <span className="w-7 text-center font-display text-[16px] font-semibold tabular-nums">{value}</span>
      <button className="grid h-9 w-9 place-items-center rounded-full text-mist-200 hover:bg-white/10 active:scale-90 disabled:opacity-30" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="more">
        <Plus size={16} />
      </button>
    </div>
  );
}
