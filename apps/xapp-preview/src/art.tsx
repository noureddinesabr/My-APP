/**
 * Flat illustrations in one palette (deep teal, mint, orange, mustard, wood), drawn in SVG so they
 * stay sharp and load instantly. Item art is chosen from the item's name.
 */
const T = '#1E5B53', TD = '#163F3A', M = '#DDEFEA', M2 = '#BFE0D8', O = '#F07A3A', Y = '#EDB33C', YD = '#C98F1E', W = '#C9945F', WD = '#A8743F', G = '#D9DFDD', GD = '#9AA5A2', S = '#E9B08A', K = '#24302E', C = '#D8A86B', CD = '#B98545';

type P = { size?: number; className?: string };
const svg = (vb: string, size: number | undefined, kids: React.ReactNode, className?: string) => (
  <svg viewBox={vb} width={size ?? '100%'} height={size ? undefined : '100%'} className={className} aria-hidden style={{ display: 'block', overflow: 'visible' }}>{kids}</svg>
);

// ---------------- Items (0 0 100 70) ----------------
export const Sofa = ({ size, className, color = Y, dark = YD }: P & { color?: string; dark?: string }) => svg('0 0 100 70', size, <>
  <ellipse cx="50" cy="64" rx="40" ry="3" fill="#000" opacity=".08" />
  <rect x="16" y="18" width="68" height="26" rx="6" fill={dark} />
  <rect x="19" y="21" width="20" height="20" rx="4" fill={color} /><rect x="40" y="21" width="20" height="20" rx="4" fill={color} /><rect x="61" y="21" width="20" height="20" rx="4" fill={color} />
  <rect x="10" y="38" width="80" height="14" rx="5" fill={color} />
  <rect x="8" y="30" width="12" height="24" rx="5" fill={dark} /><rect x="80" y="30" width="12" height="24" rx="5" fill={dark} />
  <path d="M16 54 l-2 8 M84 54 l2 8 M30 54 l-1 7 M70 54 l1 7" stroke={WD} strokeWidth="2.4" strokeLinecap="round" />
</>, className);
export const Armchair = (p: P) => svg('0 0 100 70', p.size, <>
  <ellipse cx="50" cy="65" rx="26" ry="3" fill="#000" opacity=".08" />
  <path d="M30 14 q20 -10 40 0 v28 h-40z" fill={T} />
  <circle cx="42" cy="22" r="1.4" fill={TD} /><circle cx="58" cy="22" r="1.4" fill={TD} /><circle cx="50" cy="30" r="1.4" fill={TD} />
  <rect x="26" y="38" width="48" height="14" rx="6" fill="#2A7268" />
  <rect x="22" y="30" width="11" height="22" rx="5" fill={TD} /><rect x="67" y="30" width="11" height="22" rx="5" fill={TD} />
  <path d="M32 52 l-3 10 M68 52 l3 10" stroke={WD} strokeWidth="2.6" strokeLinecap="round" />
</>, p.className);
export const Boxes = (p: P) => svg('0 0 100 70', p.size, <>
  <ellipse cx="50" cy="65" rx="38" ry="3" fill="#000" opacity=".08" />
  <rect x="14" y="36" width="34" height="28" rx="2" fill={C} /><rect x="29" y="36" width="5" height="28" fill={CD} opacity=".6" />
  <rect x="50" y="30" width="38" height="34" rx="2" fill={C} /><rect x="66" y="30" width="6" height="34" fill={CD} opacity=".6" />
  <rect x="24" y="10" width="34" height="26" rx="2" fill="#E2B67C" /><rect x="38" y="10" width="5" height="26" fill={CD} opacity=".6" />
  <path d="M54 44 h10 M54 48 h6" stroke={CD} strokeWidth="1.6" strokeLinecap="round" />
</>, p.className);
export const Fridge = (p: P) => svg('0 0 100 70', p.size, <>
  <ellipse cx="50" cy="66" rx="18" ry="2.5" fill="#000" opacity=".08" />
  <rect x="34" y="2" width="32" height="63" rx="5" fill="#F4F7F6" stroke={G} strokeWidth="1.5" />
  <path d="M34 24 h32" stroke={G} strokeWidth="1.5" /><rect x="38" y="10" width="2.6" height="9" rx="1.3" fill={GD} /><rect x="38" y="29" width="2.6" height="14" rx="1.3" fill={GD} />
</>, p.className);
export const Table = (p: P) => svg('0 0 100 70', p.size, <>
  <ellipse cx="50" cy="64" rx="34" ry="3" fill="#000" opacity=".08" />
  <rect x="14" y="26" width="72" height="7" rx="2" fill={W} /><rect x="18" y="33" width="64" height="12" rx="1" fill="#E6CFAF" />
  <path d="M30 37 h40" stroke={WD} strokeWidth="1.4" />
  <path d="M22 45 l-3 16 M78 45 l3 16" stroke={WD} strokeWidth="3" strokeLinecap="round" />
</>, p.className);
export const Shelf = (p: P) => svg('0 0 100 70', p.size, <>
  <ellipse cx="50" cy="66" rx="24" ry="2.5" fill="#000" opacity=".08" />
  <rect x="30" y="2" width="40" height="62" rx="2" fill="none" stroke={W} strokeWidth="3.5" />
  {[18, 33, 48].map((y) => <rect key={y} x="30" y={y} width="40" height="3" fill={W} />)}
  <rect x="35" y="8" width="5" height="10" fill={O} /><rect x="41" y="10" width="4" height="8" fill={T} /><circle cx="60" cy="13" r="4" fill={Y} />
  <rect x="36" y="25" width="16" height="8" rx="1" fill={C} /><path d="M56 40 q4 -9 8 0z" fill="#5FA48F" /><rect x="58" y="40" width="4" height="8" fill={WD} />
</>, p.className);
export const Washer = (p: P) => svg('0 0 100 70', p.size, <>
  <ellipse cx="50" cy="66" rx="22" ry="2.5" fill="#000" opacity=".08" />
  <rect x="28" y="6" width="44" height="58" rx="5" fill="#F4F7F6" stroke={G} strokeWidth="1.5" />
  <path d="M28 16 h44" stroke={G} strokeWidth="1.5" /><circle cx="36" cy="11" r="2" fill={O} /><rect x="54" y="9" width="12" height="4" rx="2" fill={G} />
  <circle cx="50" cy="40" r="15" fill={G} /><circle cx="50" cy="40" r="11" fill="#9FD3E6" /><path d="M42 42 q8 -6 16 0" stroke="#fff" strokeWidth="2" fill="none" opacity=".7" />
</>, p.className);
export const Bed = (p: P) => svg('0 0 100 70', p.size, <>
  <ellipse cx="50" cy="64" rx="40" ry="3" fill="#000" opacity=".08" />
  <path d="M10 12 q10 -6 20 0 v40 h-20z" fill={T} /><rect x="22" y="34" width="70" height="16" rx="3" fill="#F5F7F6" stroke={G} />
  <rect x="26" y="26" width="18" height="10" rx="4" fill="#fff" stroke={G} /><path d="M46 32 h46 v10 h-46z" fill={M2} />
  <rect x="10" y="50" width="82" height="6" rx="2" fill={TD} /><path d="M14 56 v6 M88 56 v6" stroke={TD} strokeWidth="3" />
</>, p.className);
export const Tv = (p: P) => svg('0 0 100 70', p.size, <>
  <ellipse cx="50" cy="65" rx="30" ry="2.5" fill="#000" opacity=".08" />
  <rect x="18" y="4" width="64" height="38" rx="3" fill={K} /><rect x="21" y="7" width="58" height="32" rx="1" fill="#33524E" />
  <path d="M24 34 l14 -14 l10 10 l8 -6 l20 14" fill="none" stroke="#4E7A73" strokeWidth="2" />
  <rect x="22" y="46" width="56" height="12" rx="2" fill={W} /><rect x="26" y="49" width="22" height="6" rx="1" fill={WD} /><path d="M26 58 l-2 5 M74 58 l2 5" stroke={WD} strokeWidth="2.5" strokeLinecap="round" />
</>, p.className);
export const Chair = (p: P) => svg('0 0 100 70', p.size, <>
  <ellipse cx="50" cy="66" rx="20" ry="2.5" fill="#000" opacity=".08" />
  <rect x="36" y="4" width="28" height="30" rx="4" fill={W} /><rect x="40" y="8" width="20" height="5" rx="2" fill={WD} />
  <rect x="32" y="34" width="36" height="7" rx="2" fill={WD} /><path d="M36 41 l-2 23 M64 41 l2 23" stroke={WD} strokeWidth="3" strokeLinecap="round" />
</>, p.className);
export const Wardrobe = (p: P) => svg('0 0 100 70', p.size, <>
  <ellipse cx="50" cy="66" rx="26" ry="2.5" fill="#000" opacity=".08" />
  <rect x="26" y="2" width="48" height="60" rx="3" fill={W} /><path d="M50 4 v56" stroke={WD} strokeWidth="1.6" />
  <rect x="45" y="26" width="2" height="9" rx="1" fill={K} /><rect x="53" y="26" width="2" height="9" rx="1" fill={K} /><rect x="28" y="62" width="4" height="4" fill={WD} /><rect x="68" y="62" width="4" height="4" fill={WD} />
</>, p.className);
export const Sacks = (p: P) => svg('0 0 100 70', p.size, <>
  <ellipse cx="50" cy="65" rx="38" ry="3" fill="#000" opacity=".08" />
  <path d="M14 40 q2 -10 16 -10 h14 q14 0 16 10 v16 q-2 8 -16 8 h-14 q-14 0 -16 -8z" fill="#CFC8BB" />
  <path d="M44 34 q2 -10 16 -10 h14 q14 0 16 10 v20 q-2 8 -16 8 h-14 q-14 0 -16 -8z" fill="#E1DACC" />
  <rect x="58" y="36" width="20" height="10" rx="2" fill={O} /><path d="M24 44 h18" stroke="#B3AB9B" strokeWidth="2" />
</>, p.className);
export const Cooker = (p: P) => svg('0 0 100 70', p.size, <>
  <ellipse cx="50" cy="66" rx="22" ry="2.5" fill="#000" opacity=".08" />
  <rect x="28" y="12" width="44" height="52" rx="4" fill="#F4F7F6" stroke={G} strokeWidth="1.5" />
  <rect x="28" y="6" width="44" height="8" rx="2" fill={GD} /><circle cx="40" cy="10" r="2.5" fill={K} /><circle cx="60" cy="10" r="2.5" fill={K} />
  <rect x="34" y="28" width="32" height="26" rx="3" fill={K} opacity=".85" /><circle cx="36" cy="20" r="1.8" fill={O} /><circle cx="44" cy="20" r="1.8" fill={GD} />
</>, p.className);
export const Plant = (p: P) => svg('0 0 100 70', p.size, <>
  <path d="M50 30 q-14 -18 -26 -14 q10 2 26 16 M50 30 q10 -24 24 -24 q-12 8 -22 26 M50 32 q18 -8 30 2 q-14 -2 -28 2 M50 32 q-6 -22 -2 -30" stroke="#3E8E78" strokeWidth="3" fill="none" strokeLinecap="round" />
  <path d="M40 34 h20 l-3 14 h-14z" fill={O} /><path d="M42 48 l-6 18 M58 48 l6 18 M50 48 v18" stroke={WD} strokeWidth="2" />
</>, p.className);
export const Parcel = (p: P) => svg('0 0 100 70', p.size, <>
  <ellipse cx="50" cy="65" rx="26" ry="3" fill="#000" opacity=".08" />
  <path d="M24 22 l26 -12 l26 12 v32 l-26 12 l-26 -12z" fill={C} /><path d="M24 22 l26 12 l26 -12 M50 34 v32" stroke={CD} strokeWidth="1.6" fill="none" />
  <path d="M37 16 l26 12 v8" stroke="#F3E1C4" strokeWidth="4" fill="none" />
</>, p.className);

const ART: [RegExp, (p: P) => JSX.Element][] = [
  [/sofa|couch|canap|صالون|كنب/i, Sofa], [/arm ?chair|fauteuil|فوتوي/i, Armchair], [/box|carton|كرط|كرتون|goods|marchandise|سلعة/i, Boxes], [/fridge|frigo|réfrig|تلاج|ثلاج/i, Fridge],
  [/wash|laver|صابون|غسال/i, Washer], [/bed|lit\b|mattress|matelas|ماطل|ناموس|سرير/i, Bed], [/tv|tél[ée]|television|تلفا/i, Tv], [/shelv|shelf|étag|رفوف/i, Shelf],
  [/wardrobe|armoire|خزان|دولاب/i, Wardrobe], [/cement|ciment|sack|sac|سيمة|شكاير/i, Sacks], [/cooker|cuisini|stove|كوزين|فرن/i, Cooker], [/chair|chaise|كراس|كرسي/i, Chair],
  [/table|طبلة|طاولة/i, Table], [/plant|plante|نبت/i, Plant],
];
export function ItemArt({ name, size }: { name: string; size?: number }) {
  const A = ART.find(([re]) => re.test(name))?.[1] ?? Parcel;
  return <A size={size} />;
}

// ---------------- Scenes (0 0 160 110) ----------------
const Person = ({ x, y, shirt = T, pants = K, carry }: { x: number; y: number; shirt?: string; pants?: string; carry?: boolean }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle cx="0" cy="-58" r="6" fill={S} /><path d="M-6 -60 q6 -9 12 0 q-6 -4 -12 0z" fill={K} />
    <path d="M-8 -50 h16 l2 24 h-20z" fill={shirt} />
    <path d="M-7 -26 l-2 26 h5 l3 -20 l3 20 h5 l-2 -26z" fill={pants} />
    {carry ? <><rect x="-12" y="-46" width="24" height="16" rx="1.5" fill={O} /><path d="M-12 -40 h24" stroke="#D2601F" strokeWidth="1.4" /></> : <path d="M-8 -48 l-5 18 M8 -48 l5 18" stroke={S} strokeWidth="3.5" strokeLinecap="round" />}
  </g>
);
export const VanScene = ({ size }: P) => svg('0 0 160 110', size, <>
  <ellipse cx="80" cy="102" rx="72" ry="4" fill="#000" opacity=".06" />
  <path d="M8 46 h78 v46 h-78z" fill="#F4F7F6" stroke={G} /><path d="M86 56 h26 l18 18 v18 h-44z" fill="#F4F7F6" stroke={G} />
  <path d="M90 60 h20 l13 13 h-33z" fill="#BFE0E8" /><rect x="8" y="70" width="78" height="5" fill={T} /><rect x="86" y="70" width="44" height="5" fill={T} />
  <rect x="14" y="52" width="14" height="10" rx="1.5" fill={O} /><rect x="30" y="54" width="10" height="8" rx="1" fill={C} />
  <circle cx="30" cy="94" r="9" fill={K} /><circle cx="30" cy="94" r="4" fill={G} /><circle cx="110" cy="94" r="9" fill={K} /><circle cx="110" cy="94" r="4" fill={G} />
  <Person x={62} y={100} carry />
</>);
export const ScanScene = ({ size }: P) => svg('0 0 160 110', size, <>
  <ellipse cx="80" cy="104" rx="66" ry="4" fill="#000" opacity=".06" />
  <g transform="translate(18 40) scale(.9)"><Sofa /></g>
  <rect x="78" y="6" width="46" height="88" rx="8" fill={K} /><rect x="81" y="11" width="40" height="78" rx="5" fill="#F7FBFA" />
  <g transform="translate(82 34) scale(.38)"><Sofa /></g>
  <path d="M86 26 v-6 h6 M116 26 v-6 h-6 M86 70 v6 h6 M116 70 v6 h-6" stroke={T} strokeWidth="2" fill="none" />
  <path d="M90 52 l10 -8 l10 8 l-10 6z M90 52 l10 6 v8 M110 52 l-10 6" stroke="#fff" strokeWidth=".8" fill="none" />
  <circle cx="101" cy="83" r="3.4" fill={T} />
  <path d="M136 18 l3 -7 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3z" fill={O} /><path d="M142 44 l1.5 -4 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5z" fill={Y} />
</>);
export const GalleryScene = ({ size }: P) => svg('0 0 120 90', size, <>
  <rect x="34" y="12" width="56" height="44" rx="5" fill="#fff" stroke={G} transform="rotate(8 62 34)" />
  <rect x="24" y="20" width="56" height="44" rx="5" fill="#fff" stroke={G} />
  <rect x="28" y="24" width="48" height="30" rx="3" fill={M2} /><circle cx="64" cy="32" r="4" fill={Y} /><path d="M28 54 l14 -14 l10 10 l8 -6 l16 10z" fill={T} />
  <circle cx="86" cy="66" r="12" fill={O} /><path d="M86 60 v12 M80 66 h12" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
</>);
export const ListScene = ({ size }: P) => svg('0 0 120 90', size, <>
  <rect x="34" y="8" width="48" height="66" rx="5" fill="#fff" stroke={G} /><rect x="48" y="4" width="20" height="9" rx="3" fill={T} />
  {[24, 38, 52].map((y, i) => <g key={y}><rect x="40" y={y} width="7" height="7" rx="2" fill={i < 2 ? T : 'none'} stroke={T} strokeWidth="1.4" /><rect x="51" y={y + 2} width="24" height="3" rx="1.5" fill={G} /></g>)}
  <path d="M88 30 l10 -10 l5 5 l-10 10 l-7 2z" fill={O} /><path d="M98 20 l5 5" stroke="#fff" strokeWidth="1" />
</>);
export const DoneScene = ({ size }: P) => svg('0 0 160 110', size, <>
  <ellipse cx="80" cy="102" rx="64" ry="4" fill="#000" opacity=".06" />
  <rect x="20" y="10" width="44" height="90" rx="3" fill={W} /><rect x="25" y="15" width="34" height="85" rx="2" fill="#DDB98F" /><circle cx="53" cy="58" r="2.4" fill={K} />
  <g transform="translate(66 46) scale(.6)"><Boxes /></g>
  <Person x={128} y={100} shirt={T} />
  <circle cx="140" cy="22" r="13" fill={O} /><path d="M134 22 l4.5 4.5 l8 -9" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
</>);
export const CashScene = ({ size }: P) => svg('0 0 120 90', size, <>
  <rect x="18" y="30" width="70" height="38" rx="4" fill="#8CC7A1" transform="rotate(-8 53 49)" /><rect x="26" y="34" width="70" height="38" rx="4" fill="#A9D8B8" />
  <circle cx="61" cy="53" r="10" fill="none" stroke={T} strokeWidth="2" /><text x="61" y="57" textAnchor="middle" fontSize="10" fontWeight="800" fill={T}>DH</text>
  <circle cx="92" cy="24" r="10" fill={Y} /><circle cx="100" cy="36" r="8" fill={YD} />
</>);
export const DriverScene = ({ size }: P) => svg('0 0 160 110', size, <>
  <ellipse cx="80" cy="102" rx="72" ry="4" fill="#000" opacity=".06" />
  <path d="M40 40 h66 v52 h-66z" fill="#F4F7F6" stroke={G} /><path d="M106 52 h22 l16 18 v22 h-38z" fill="#F4F7F6" stroke={G} />
  <path d="M110 56 h16 l12 13 h-28z" fill="#BFE0E8" /><rect x="40" y="70" width="104" height="5" fill={T} />
  <text x="73" y="62" textAnchor="middle" fontSize="13" fontWeight="900" fill={T}>X<tspan fill={O}>app</tspan></text>
  <circle cx="60" cy="94" r="9" fill={K} /><circle cx="60" cy="94" r="4" fill={G} /><circle cx="126" cy="94" r="9" fill={K} /><circle cx="126" cy="94" r="4" fill={G} />
  <Person x={22} y={100} shirt={O} />
  <rect x="28" y="40" width="9" height="15" rx="2" fill={K} transform="rotate(-10 32 47)" />
</>);
export const VoiceScene = ({ size }: P) => svg('0 0 120 90', size, <>
  <circle cx="60" cy="45" r="30" fill={M2} /><circle cx="60" cy="45" r="20" fill={T} />
  <rect x="55" y="33" width="10" height="16" rx="5" fill="#fff" /><path d="M51 45 q9 10 18 0 M60 52 v6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
  <path d="M18 45 v0 M24 38 v14 M30 32 v26 M90 32 v26 M96 38 v14 M102 45 v0" stroke={O} strokeWidth="3" strokeLinecap="round" />
</>);
export const RouteScene = ({ size }: P) => svg('0 0 120 90', size, <>
  <path d="M20 70 q30 -50 50 -20 t30 -30" stroke={T} strokeWidth="3" fill="none" strokeDasharray="5 6" strokeLinecap="round" />
  <circle cx="20" cy="70" r="7" fill="#fff" stroke={T} strokeWidth="3" />
  <path d="M100 26 c-6 -7 -7 -10 -7 -13 a7 7 0 1 1 14 0 c0 3 -1 6 -7 13z" fill={O} /><circle cx="100" cy="13" r="2.6" fill="#fff" />
</>);

/** The wordmark: "X" in orange, "app" in teal (rounded geometric type). */
export function Logo({ size = 22, light }: { size?: number; light?: boolean }) {
  return (
    <span className="logo" style={{ fontSize: size }} dir="ltr">
      <b style={{ color: light ? '#fff' : 'var(--ink)' }}>X</b><b style={{ color: 'var(--orange)' }}>APP</b>
    </span>
  );
}
