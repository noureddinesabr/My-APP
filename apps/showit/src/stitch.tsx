import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useT } from './i18n';
import { Font, hasArabic } from './theme';
import { T, Tag, tap, useColors } from './ui';

/**
 * Building blocks of the Stitch design (owner's export, 16 Nov 2026): a screen head with a sage
 * "[ TAG ]" and an Outfit title, white boxes with a fine line, soft sage boxes, dark forest-green
 * boxes for the one number that matters (price, ETA), stat tiles, segmented choices and small
 * technical lines in Space Grotesk.
 */

/** Screen head: optional back arrow, the tag, the title, and something small on the far side (a step, a time). */
export function Head({ tag, title, sub, side, onBack }: { tag?: string; title: string; sub?: string; side?: string; onBack?: () => void }) {
  const c = useColors();
  const { rtl } = useT();
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

/** A small technical line (Space Grotesk capitals); Arabic stays in its own font. */
export function Tech({ children, color, style }: { children: string; color?: string; style?: object }) {
  const c = useColors();
  const arabic = hasArabic(children);
  return (
    <Text
      maxFontSizeMultiplier={1.2}
      style={[arabic ? { fontFamily: Font.arabicBold, fontSize: 12, lineHeight: 18 } : { fontFamily: Font.label, fontSize: 11, lineHeight: 15, letterSpacing: 1 }, { color: color ?? c.muted }, style]}>
      {arabic ? children : children.toUpperCase()}
    </Text>
  );
}

/** A box: 'plain' white with a fine line, 'soft' sage, 'dark' forest green (white text inside). */
export function Box({ children, tone = 'plain', style }: { children: ReactNode; tone?: 'plain' | 'soft' | 'dark'; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const bg = tone === 'dark' ? '#021E1A' : tone === 'soft' ? c.raised : c.surface;
  return <View style={[{ backgroundColor: bg, borderRadius: 16, padding: 16, gap: 12, borderWidth: tone === 'plain' ? 1 : 0, borderColor: c.line }, style]}>{children}</View>;
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
            <T size={13} weight="bold" color={dark ? '#A6F2CF' : c.accent} style={{ textDecorationLine: 'underline' }}>
              {side}
            </T>
          </Pressable>
        ) : (
          <Tech color={dark ? '#A6F2CF' : undefined}>{side}</Tech>
        )
      ) : null}
    </View>
  );
}

/** A stat tile: a small label, a big number and its unit. */
export function Stat({ label, value, unit, dark, style }: { label: string; value: string; unit?: string; dark?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <View style={[{ flex: 1, backgroundColor: dark ? 'rgba(255,255,255,0.08)' : c.raised, borderRadius: 12, padding: 10, gap: 2 }, style]}>
      <Tech color={dark ? '#A6F2CF' : undefined}>{label}</Tech>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <T size={22} weight="heavy" color={dark ? '#FFFFFF' : undefined}>
          {value}
        </T>
        {unit ? (
          <T size={13} weight="semibold" color={dark ? '#C1EBE0' : c.muted}>
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
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: dark ? 'rgba(255,255,255,0.1)' : c.liveSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={Math.round(size * 0.48)} color={dark ? '#A6F2CF' : c.live} />
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
