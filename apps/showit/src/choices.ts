// The quick choices a customer taps; the AI pre-selects them and the customer can change any.

export const GOODS = ['furniture', 'appliances', 'boxes', 'building', 'food', 'machines', 'move', 'other'] as const;
export type Goods = (typeof GOODS)[number];

export const GOODS_ICON: Record<Goods, string> = {
  furniture: 'bed-outline',
  appliances: 'snow-outline',
  boxes: 'cube-outline',
  building: 'construct-outline',
  food: 'nutrition-outline',
  machines: 'cog-outline',
  move: 'home-outline',
  other: 'ellipsis-horizontal',
};

/** Weight choices in kg, with the label shown. */
export const WEIGHTS: { kg: number; label: string }[] = [
  { kg: 250, label: '≈ 250 kg' },
  { kg: 500, label: '≈ 500 kg' },
  { kg: 1000, label: '≈ 1 t' },
  { kg: 1500, label: '≈ 1.5 t' },
  { kg: 3000, label: '≈ 3 t' },
  { kg: 5000, label: '≈ 5 t' },
  { kg: 10000, label: '≈ 10 t' },
  { kg: 20000, label: '20 t +' },
];

/** The weight choice closest to an estimate. */
export function nearestWeight(kg: number) {
  if (!kg) return 0;
  return WEIGHTS.reduce((best, w) => (Math.abs(w.kg - kg) < Math.abs(best - kg) ? w.kg : best), WEIGHTS[0].kg);
}

export const NOTE_TAGS = ['lift', 'noLift', 'ground', 'upstairs', 'fragile', 'heavy', 'narrow', 'strap'] as const;
export type NoteTag = (typeof NOTE_TAGS)[number];
