import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useT } from './i18n';
import { fade, Font, hasArabic } from './theme';
import { Glow, T, Tag, tap, useColors, type GlowTone } from './ui';

/**
 * Building blocks of the Xapp Freight design (owner's second Stitch export, 17 Nov 2026): a screen
 * head with a small mono label and a bold title, white glass boxes (24 radius, fine line), soft
 * stone boxes, deep moss boxes for the one number that matters (mission, price), the sky-blue ETA
 * box, stat tiles, segmented choices and small labels (redesign 2: everything in soft gradients).
 */

/** Screen head: optional back arrow, the tag, the title, and something small on the far side (a step, a time). */
export function Head({ tag, title, sub, side, onBack, slim }: { tag?: string; title: string; sub?: string; side?: string; onBack?: () => void; /** One short line (owner's edit #10: pages that must fit one screen). */ slim?: boolean }) {
  const c = useColors();
  const { rtl } = useT();
  if (slim)
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {onBack ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} onPress={onBack} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={rtl ? 'arrow-forward' : 'arrow-back'} size={21} color={c.fg} />
          </Pressable>
        ) : null}
        <T size={19} weight="heavy" style={{ flex: 1 }}>
          {title}
        </T>
        {side ? <Tech>{side}</Tech> : null}
      </View>
    );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
      {onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} onPress={onBack} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
          <Ionicons name={rtl ? 'arrow-forward' : 'arrow-back'} size={22} color={c.fg} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1, gap: 4 }}>
        {tag ? <Tag>{tag}</Tag> : null}
        <T size={24} weight="heavy">
          {title}
        </T>
        {sub ? (
          <T size={14} muted>
            {sub}
          </T>
        ) : null}
      </View>
      {side ? <Tech style={{ marginTop: 6 }}>{side}</Tech> : null}
    </View>
  );
}

/** A small label line (Inter Medium, as written, like «Effective Saudization»); Arabic stays in its own font. */
export function Tech({ children, color, style }: { children: string; color?: string; style?: object }) {
  const c = useColors();
  const arabic = hasArabic(children);
  return (
    <Text
      maxFontSizeMultiplier={1.2}
      style={[arabic ? { fontFamily: Font.arabicBold, fontSize: 12, lineHeight: 18 } : { fontFamily: Font.label, fontSize: 12, lineHeight: 16 }, { color: color ?? c.muted }, style]}>
      {children}
    </Text>
  );
}

/** A box: 'plain' white glass with a fine line, 'soft' stone, 'dark' deep moss (white text inside), 'sky' the ETA blue. */
export function Box({ children, tone = 'plain', style }: { children: ReactNode; tone?: 'plain' | 'soft' | 'dark' | 'sky'; style?: StyleProp<ViewStyle> }) {
  const glow: GlowTone = tone === 'dark' ? 'dark' : tone === 'sky' ? 'sky' : tone === 'soft' ? 'soft' : 'glass';
  return <Glow tone={glow} style={[{ borderRadius: 26, padding: 16, gap: 12 }, style]}>{children}</Glow>;
}

/** The box's top line: a tag, and an optional note or action on the far side. */
export function BoxHead({ tag, side, onSide, dark }: { tag: string; side?: string; onSide?: () => void; dark?: boolean }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <Tag tone={dark ? 'plain' : 'live'} style={dark ? { paddingHorizontal: 0 } : undefined}>
        {tag}
      </Tag>
      {side ? (
        onSide ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              tap();
              onSide();
            }}>
            <T size={13} weight="bold" color={dark ? c.inverseLabel : c.accent} style={{ textDecorationLine: 'underline' }}>
              {side}
            </T>
          </Pressable>
        ) : (
          <Tech color={dark ? c.inverseLabel : undefined}>{side}</Tech>
        )
      ) : null}
    </View>
  );
}

/** A stat tile: a small label, a big number and its unit. */
export function Stat({ label, value, unit, dark, style }: { label: string; value: string; unit?: string; dark?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <View style={[{ flex: 1, backgroundColor: dark ? fade(c.onInverse, 0.08) : c.raised, borderRadius: 16, padding: 12, gap: 2 }, style]}>
      <Tech color={dark ? c.inverseLabel : undefined}>{label}</Tech>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <T size={22} weight="heavy" color={dark ? c.onInverse : undefined}>
          {value}
        </T>
        {unit ? (
          <T size={13} weight="semibold" color={dark ? c.onInverseMuted : c.muted}>
            {unit}
          </T>
        ) : null}
      </View>
    </View>
  );
}

/** Segmented choice: a sage track, the chosen one dark. */
export function Seg<K extends string>({ items, value, onChange, testID }: { items: [K, string][]; value: K | undefined; onChange: (k: K) => void; testID?: string }) {
  const c = useColors();
  return (
    <View testID={testID} style={{ flexDirection: 'row', backgroundColor: c.raised, borderRadius: 999, padding: 4, gap: 4 }}>
      {items.map(([k, label]) => {
        const on = value === k;
        return (
          <Pressable
            key={k}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={label}
            onPress={() => {
              tap();
              onChange(k);
            }}
            style={{ flex: 1, minHeight: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, backgroundColor: on ? c.accent : 'transparent' }}>
            <T size={14} weight="bold" color={on ? c.onAccent : c.fg} style={{ textAlign: 'center' }}>
              {label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A round icon in a sage circle (list rows). */
export function IconDot({ icon, size = 40, dark }: { icon: keyof typeof Ionicons.glyphMap; size?: number; dark?: boolean }) {
  const c = useColors();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: dark ? fade(c.onInverse, 0.1) : c.liveSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={Math.round(size * 0.48)} color={dark ? c.inverseLabel : c.live} />
    </View>
  );
}

/** The icon that best fits an item name (furniture, boxes, appliances...). */
export function itemIcon(name: string): keyof typeof Ionicons.glyphMap {
  const n = name.toLowerCase();
  if (/box|carton|caisse|كرتون|صندوق|sac|bag/.test(n)) return 'cube-outline';
  if (/fridge|frigo|réfrig|ثلاج|washing|machine|oven|four|cuisin|غسال|tv|télé|تلفاز/.test(n)) return 'snow-outline';
  if (/bed|lit|سرير|mattress|matelas/.test(n)) return 'bed-outline';
  if (/sofa|canap|كنب|صالون|chair|chaise|كرسي|fauteuil/.test(n)) return 'easel-outline';
  if (/table|طاول|desk|bureau/.test(n)) return 'grid-outline';
  if (/mirror|miroir|مرآ|glass|verre/.test(n)) return 'scan-outline';
  return 'cube-outline';
}
