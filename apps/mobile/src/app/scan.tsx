import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { PressableScale } from '@/components/motion/pressable-scale';
import { Sheet } from '@/components/sheet';
import { Text } from '@/components/text';
import type { FreightTypeId } from '@/constants/freight';
import { play } from '@/lib/sounds';
import { useRequestDraft } from '@/state/request-draft';
import { useRole } from '@/state/role';
import { markScanSeen } from '@/state/scan-seen';
import { Radius, Spacing, useColors } from '@/theme';

/**
 * The first screen: snap the load (up to 6 photos), the AI recognises the items, and a panel
 * slides up over the photo with the list (− / + / remove, add more, total weight). Continue
 * opens the client flow with the load already filled in.
 */

type Icon = ComponentProps<typeof MaterialCommunityIcons>['name'];
type Key = 'sofa' | 'fridge' | 'boxes' | 'table' | 'bed' | 'wardrobe' | 'washer' | 'tv' | 'chair' | 'mattress' | 'cooker' | 'other';
type Box = { x: number; y: number; w: number; h: number };
type Item = { key: Key; label?: string; qty: number; kg: number; box?: Box };
type Photo = { uri: string; sample?: boolean };

const CATALOG: Record<Key, { kg: number; icon: Icon; type: FreightTypeId }> = {
  sofa: { kg: 80, icon: 'sofa-outline', type: 'items' },
  fridge: { kg: 70, icon: 'fridge-outline', type: 'items' },
  boxes: { kg: 15, icon: 'package-variant-closed', type: 'goods' },
  table: { kg: 25, icon: 'table-furniture', type: 'items' },
  bed: { kg: 55, icon: 'bed-outline', type: 'items' },
  wardrobe: { kg: 75, icon: 'wardrobe-outline', type: 'items' },
  washer: { kg: 70, icon: 'washing-machine', type: 'items' },
  tv: { kg: 15, icon: 'television', type: 'items' },
  chair: { kg: 6, icon: 'chair-rolling', type: 'items' },
  mattress: { kg: 25, icon: 'bed-single-outline', type: 'items' },
  cooker: { kg: 45, icon: 'stove', type: 'items' },
  other: { kg: 20, icon: 'cube-outline', type: 'other' },
};
const KEYS = Object.keys(CATALOG).filter((k) => k !== 'other') as Key[];
const SAMPLE = require('@/assets/images/sample-room.webp');
const SAMPLE_SIZE = { w: 739, h: 415 };
const SAMPLE_ITEMS: Item[] = [
  { key: 'sofa', qty: 1, kg: 80, box: { x: 0.13, y: 0.42, w: 0.48, h: 0.42 } },
  { key: 'boxes', qty: 7, kg: 15, box: { x: 0.57, y: 0.2, w: 0.23, h: 0.45 } },
  { key: 'table', qty: 1, kg: 25, box: { x: 0.5, y: 0.68, w: 0.27, h: 0.3 } },
];
const MAX = 6;
const SCAN_PROMPT = `List the movable objects a customer wants transported in these photos (ignore walls, floors, people, fixed things). Count each object once across photos. For "key" use one of: ${Object.keys(CATALOG).join(', ')} (use "other" plus a short "label" if none fits). Give "qty", an honest typical weight per piece "kg", and the object's box in the FIRST photo as fractions 0-1: {"x","y","w","h"}. JSON only: {"items":[{"key":"sofa","label":"","qty":1,"kg":80,"box":{"x":0.1,"y":0.4,"w":0.5,"h":0.4}}]}`;

/** Real AI where the page offers it (the claude.ai preview); null elsewhere. */
async function readWithAI(photos: Photo[]): Promise<Item[] | null> {
  const host = (globalThis as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
  if (Platform.OS !== 'web' || !host?.use) return null;
  try {
    const sample = (await host.use('sample')) as { json: (p: string, o: unknown) => Promise<unknown> } | null;
    if (!sample) return null;
    const images = await Promise.all(photos.slice(0, 4).map((p) => fetch(p.uri).then((r) => r.blob())));
    const out = (await sample.json(SCAN_PROMPT, { images, modelTier: 'default' })) as { items?: Partial<Item & { label: string }>[] };
    if (!Array.isArray(out?.items)) return null;
    return out.items.slice(0, 10).map((i) => {
      const key = (i.key && i.key in CATALOG ? i.key : 'other') as Key;
      return { key, label: key === 'other' ? i.label || undefined : undefined, qty: Math.max(1, Math.round(Number(i.qty) || 1)), kg: Math.round(Number(i.kg) || CATALOG[key].kg), box: i.box };
    });
  } catch {
    return null;
  }
}

/** A triangle mesh over a box (the "AI is reading it" look). */
function meshPath(r: { x: number; y: number; w: number; h: number }, seed: number) {
  const cols = 6;
  const rows = 4;
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280 - 0.5);
  const pts: [number, number][] = [];
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i <= cols; i++)
      pts.push([r.x + (r.w * i) / cols + (i && i < cols ? (rnd() * r.w) / cols / 2 : 0), r.y + (r.h * j) / rows + (j && j < rows ? (rnd() * r.h) / rows / 2 : 0)]);
  const P = (i: number, j: number) => pts[j * (cols + 1) + i].map((n) => n.toFixed(1)).join(',');
  let d = '';
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) d += `M${P(i, j)}L${P(i + 1, j)}L${P(i + 1, j + 1)}L${P(i, j)}L${P(i, j + 1)}L${P(i + 1, j + 1)}`;
  return d;
}

export default function ScanScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { width: W, height: H } = useWindowDimensions();
  const { setRole } = useRole();
  const { update } = useRequestDraft();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [phase, setPhase] = useState<'camera' | 'analysing' | 'results'>('camera');
  const [items, setItems] = useState<Item[]>([]);
  const [shown, setShown] = useState(0);
  const [source, setSource] = useState<'sample' | 'ai' | 'none' | 'manual'>('manual');
  const [size, setSize] = useState(SAMPLE_SIZE);
  const [adding, setAdding] = useState(false);
  const photoH = useRef(new Animated.Value(H)).current;
  const panel = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  const results = phase !== 'camera';
  const areaH = results ? Math.round(H * 0.5) : H;
  useEffect(() => {
    Animated.timing(photoH, { toValue: areaH, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    Animated.spring(panel, { toValue: results ? 1 : 0, useNativeDriver: true, damping: 18, stiffness: 140 }).start();
  }, [areaH, results, photoH, panel]);
  useEffect(() => {
    if (phase !== 'analysing') return;
    const loop = Animated.loop(Animated.timing(sweep, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [phase, sweep]);

  const front = photos[0];
  const cover = useMemo(() => {
    const s = Math.max(W / size.w, areaH / size.h);
    const w = size.w * s;
    const h = size.h * s;
    return { x: (W - w) / 2, y: (areaH - h) / 2, w, h };
  }, [W, areaH, size]);
  const toScreen = (b: Box) => ({ x: cover.x + b.x * cover.w, y: cover.y + b.y * cover.h, w: b.w * cover.w, h: b.h * cover.h });

  const total = items.reduce((n, i) => n + i.kg * i.qty, 0);
  const name = (i: Item) => (i.key === 'other' && i.label ? i.label : t(`scan.items.${i.key}`));

  async function analyse(list: Photo[]) {
    setPhase('analysing');
    setShown(0);
    play('whoosh');
    const started = Date.now();
    const sampleOnly = list.length === 1 && list[0].sample;
    const found = sampleOnly ? SAMPLE_ITEMS : await readWithAI(list);
    await new Promise((r) => setTimeout(r, Math.max(0, 2500 - (Date.now() - started))));
    const next = found ?? [];
    setItems(next);
    setSource(sampleOnly ? 'sample' : found ? 'ai' : 'none');
    setPhase('results');
    next.forEach((_, i) => setTimeout(() => (setShown(i + 1), play('pop')), 250 + i * 380));
    if (next.length) setTimeout(() => play('success'), 350 + next.length * 380);
    else setTimeout(() => setAdding(true), 600);
  }

  async function pick(camera: boolean) {
    play('tap');
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, allowsMultipleSelection: !camera, selectionLimit: MAX - photos.length };
    try {
      if (camera && Platform.OS !== 'web') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return pick(false);
      }
      const res = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (res.canceled) return;
      const added = res.assets.map((a) => ({ uri: a.uri }));
      const next = [...photos.filter((p) => !p.sample), ...added].slice(0, MAX);
      setPhotos(next);
      const first = res.assets[0];
      if (!photos.length && first?.width && first?.height) setSize({ w: first.width, h: first.height });
      if (phase === 'results') analyse(next);
    } catch {
      // picker closed or not available
    }
  }

  const useSample = () => {
    play('tap');
    const list = [{ uri: '', sample: true }];
    setPhotos(list);
    setSize(SAMPLE_SIZE);
    analyse(list);
  };
  const skip = () => {
    play('tap');
    markScanSeen();
    router.replace('/');
  };
  const reset = () => {
    play('tap');
    setPhotos([]);
    setItems([]);
    setSize(SAMPLE_SIZE);
    setPhase('camera');
  };
  const add = (key: Key) => {
    play('pop');
    setItems((cur) => (cur.some((i) => i.key === key) ? cur.map((i) => (i.key === key ? { ...i, qty: i.qty + 1 } : i)) : [...cur, { key, qty: 1, kg: CATALOG[key].kg }]));
    setAdding(false);
    if (phase === 'camera') setPhase('results');
  };
  const proceed = () => {
    if (!items.length) return;
    play('success');
    const types = [...new Set(items.map((i) => CATALOG[i.key].type))];
    update({
      freightTypes: types,
      freightType: types[0],
      tons: Math.max(0.1, Math.round(total / 100) / 10),
      weightKnown: true,
      notes: items.map((i) => `${name(i)} ×${i.qty}`).join(t('common.listSep')),
      step: 0,
    });
    markScanSeen();
    setRole('client');
    router.replace('/client');
  };

  const showPhoto = front ? (front.sample ? SAMPLE : { uri: front.uri }) : SAMPLE;
  const tip = !photos.length || photos[0].sample ? t('scan.tapToTake') : photos.length < MAX ? t('scan.takeAnother') : t('scan.maxPhotos');
  const ready = photos.length > 0 && !photos[0]?.sample;
  const title = !items.length && source === 'manual' ? t('scan.yourLoad') : !items.length ? t('scan.hmm') : t('scan.great');
  const subtitle = !items.length && source === 'manual' ? t('scan.addWhat') : !items.length ? t('scan.tellUs') : source === 'manual' ? t('scan.soFar') : t('scan.recognized');
  const note = source === 'sample' ? t('scan.sampleNote') : source === 'ai' ? t('scan.aiNote') : source === 'none' ? t('scan.noAiNote') : '';
  const camMesh = !results && !ready ? meshPath(toScreen(SAMPLE_ITEMS[0].box!), 7) : '';
  const resultMesh = phase === 'results' ? items.slice(0, shown).map((i, k) => (i.box ? meshPath(toScreen(i.box), 11 + k) : '')).join('') : '';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* photo */}
      <Animated.View style={[styles.photo, { height: photoH }]}>
        <Image source={showPhoto} style={StyleSheet.absoluteFill} contentFit="cover" onLoad={(e) => e.source?.width && setSize({ w: e.source.width, h: e.source.height })} />
        <View style={[styles.shadeTop]} />
        <View style={[styles.shadeBottom]} />
        <Svg width={W} height={areaH} style={StyleSheet.absoluteFill} pointerEvents="none">
          {!!camMesh && <Path d={camMesh} stroke="rgba(255,255,255,0.8)" strokeWidth={1} fill="none" />}
          {!!resultMesh && <Path d={resultMesh} stroke="rgba(255,255,255,0.35)" strokeWidth={1} fill="none" />}
        </Svg>
        {phase === 'analysing' && (
          <Animated.View pointerEvents="none" style={[styles.sweep, { backgroundColor: colors.primaryFill, transform: [{ translateY: sweep.interpolate({ inputRange: [0, 1], outputRange: [-40, areaH] }) }] }]} />
        )}
        {phase === 'results' &&
          items.slice(0, shown).map((i, k) => {
            if (!i.box) return null;
            const r = toScreen(i.box);
            return (
              <View key={`${i.key}${k}`} pointerEvents="none">
                <View style={[styles.outline, { left: r.x, top: r.y, width: r.w, height: r.h, borderColor: colors.primaryFill, shadowColor: colors.primaryFill }]} />
                <View style={[styles.chip, { left: Math.max(8, Math.min(W - 130, r.x + r.w - 96)), top: Math.max(130, r.y + 8), backgroundColor: colors.surface, borderColor: colors.rim }]}>
                  <View style={[styles.chipIcon, { backgroundColor: colors.primaryFill }]}>
                    <MaterialCommunityIcons name={CATALOG[i.key].icon} size={15} color={colors.onPrimary} />
                  </View>
                  <View>
                    <Text variant="caption" style={styles.chipText}>
                      {name(i)}
                    </Text>
                    <Text variant="caption" muted style={styles.chipSub}>
                      ×{i.qty}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        {phase === 'analysing' && (
          <View style={styles.analysing} pointerEvents="none">
            <Text variant="label" color="#FFFFFF">
              {t('scan.analysing')}
            </Text>
          </View>
        )}
        {results && (
          <View style={styles.hello} pointerEvents="none">
            {phase === 'results' && (
              <>
                <Text variant="hero" color="#FFFFFF">
                  {title}
                </Text>
                <Text variant="subtitle" color="#FFFFFF" style={{ maxWidth: 230 }}>
                  {subtitle}
                </Text>
                <View style={[styles.stroke, { backgroundColor: colors.primaryFill }]} />
              </>
            )}
          </View>
        )}
      </Animated.View>

      {/* top bar */}
      <View style={styles.top}>
        <PressableScale onPress={results ? reset : skip} accessibilityRole="button" accessibilityLabel={t('common.back')} style={[styles.round, styles.glass]}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
        </PressableScale>
        <View style={[styles.pill, styles.glass]}>
          <MaterialCommunityIcons name="creation" size={18} color={colors.primaryFill} />
          <Text variant="caption" color="#FFFFFF" style={{ fontWeight: '700' }}>
            {results ? t('scan.aiPowered') : ready ? t('scan.photos', { count: photos.length }) : t('scan.aiScan')}
          </Text>
        </View>
      </View>

      {/* camera controls */}
      {!results && (
        <View style={styles.controls}>
          {ready && (
            <View style={styles.thumbs}>
              {photos.map((p) => (
                <Image key={p.uri} source={{ uri: p.uri }} style={styles.thumb} />
              ))}
            </View>
          )}
          <View style={styles.tip}>
            <Text variant="caption" color="#111111" style={{ fontWeight: '700' }}>
              {tip}
            </Text>
          </View>
          <View style={styles.row}>
            <PressableScale onPress={useSample} accessibilityRole="button" accessibilityLabel={t('scan.samplePhoto')} style={[styles.side, styles.glass]}>
              <MaterialCommunityIcons name="sofa-outline" size={24} color="#FFFFFF" />
            </PressableScale>
            <PressableScale onPress={() => (ready ? analyse(photos) : pick(true))} feedback="medium" accessibilityRole="button" accessibilityLabel={t('scan.shutter')} style={styles.shutter}>
              <View style={[styles.shutterInner, { backgroundColor: colors.primaryFill, shadowColor: colors.primaryFill }]}>
                <MaterialCommunityIcons name={ready ? 'check-bold' : 'line-scan'} size={28} color={colors.onPrimary} />
              </View>
            </PressableScale>
            <PressableScale onPress={() => pick(false)} accessibilityRole="button" accessibilityLabel={t('scan.gallery')} style={[styles.side, styles.glass]}>
              <MaterialCommunityIcons name="paperclip" size={24} color="#FFFFFF" />
            </PressableScale>
          </View>
          <PressableScale onPress={skip} accessibilityRole="button">
            <Text variant="caption" color="#FFFFFF" style={styles.skip}>
              {t('scan.skip')}
            </Text>
          </PressableScale>
        </View>
      )}

      {/* results panel */}
      <Animated.View
        pointerEvents={results ? 'auto' : 'none'}
        style={[styles.panel, { height: H - areaH + 28, backgroundColor: colors.background, borderColor: colors.rim, transform: [{ translateY: panel.interpolate({ inputRange: [0, 1], outputRange: [H, 0] }) }] }]}>
        <View style={[styles.grab, { backgroundColor: colors.border }]} />
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.sm }}>
          {phase === 'analysing'
            ? [0, 1, 2].map((k) => <View key={k} style={[styles.item, { backgroundColor: colors.surface, height: 76, opacity: 0.6 }]} />)
            : items.map((i, k) => (
                <View key={`${i.key}${k}`} style={[styles.item, { backgroundColor: colors.surface }]}>
                  <Thumb item={i} photo={front} size={size} />
                  <View style={{ flex: 1 }}>
                    <Text variant="label">{name(i)}</Text>
                    <Text variant="caption" muted>
                      {t('scan.approxKg', { kg: i.kg })}
                    </Text>
                  </View>
                  <View style={[styles.stepper, { backgroundColor: colors.control }]}>
                    <PressableScale onPress={() => (play('tick'), setItems((c) => c.map((x, n) => (n === k ? { ...x, qty: Math.max(1, x.qty - 1) } : x))))} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel="−">
                      <MaterialCommunityIcons name="minus" size={18} color={colors.onControl} />
                    </PressableScale>
                    <Text variant="label" style={{ minWidth: 26, textAlign: 'center' }}>
                      {i.qty}
                    </Text>
                    <PressableScale onPress={() => (play('tick'), setItems((c) => c.map((x, n) => (n === k ? { ...x, qty: x.qty + 1 } : x))))} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel="+">
                      <MaterialCommunityIcons name="plus" size={18} color={colors.onControl} />
                    </PressableScale>
                  </View>
                  <PressableScale onPress={() => (play('tap'), setItems((c) => c.filter((_, n) => n !== k)))} accessibilityRole="button" accessibilityLabel={t('scan.remove', { name: name(i) })} style={[styles.del, { backgroundColor: colors.accentSoft }]}>
                    <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.accent} />
                  </PressableScale>
                </View>
              ))}
          {phase === 'results' && (
            <PressableScale onPress={() => (play('tap'), setAdding(true))} accessibilityRole="button" style={[styles.addMore, { borderColor: colors.border }]}>
              <MaterialCommunityIcons name="plus-circle-outline" size={20} color={colors.text} />
              <Text variant="label">{t('scan.addMore')}</Text>
            </PressableScale>
          )}
        </ScrollView>
        <View style={[styles.total, { backgroundColor: colors.primarySoft }]}>
          <MaterialCommunityIcons name="lightbulb-on-outline" size={20} color={colors.primary} />
          <Text variant="caption" style={{ flex: 1 }}>
            {t('scan.total')}{' '}
            <Text variant="caption" color={colors.primary} style={{ fontWeight: '800' }}>
              {t('scan.approxKg', { kg: total })}
            </Text>
          </Text>
          <Text variant="caption" muted>
            {t('scan.estimate')}
          </Text>
        </View>
        <View style={styles.actions}>
          <PressableScale onPress={() => (photos.length >= MAX ? null : pick(false))} accessibilityRole="button" style={[styles.btn, { flex: 1, backgroundColor: colors.surface, borderColor: colors.rim, borderWidth: 1 }]}>
            <MaterialCommunityIcons name="image-plus" size={20} color={colors.text} />
            <Text variant="label">{t('scan.addPhotos')}</Text>
          </PressableScale>
          <PressableScale onPress={proceed} disabled={!items.length} feedback="medium" accessibilityRole="button" style={[styles.btn, { flex: 1.3, backgroundColor: colors.cta, opacity: items.length ? 1 : 0.45 }]}>
            <Text variant="label" color={colors.onCta}>
              {t('common.continue')}
            </Text>
            <MaterialCommunityIcons name="arrow-right" size={20} color={colors.onCta} />
          </PressableScale>
        </View>
        {!!note && (
          <Text variant="caption" muted center style={{ fontSize: 12, lineHeight: 16, paddingBottom: Spacing.sm, paddingHorizontal: Spacing.lg }}>
            {note}
          </Text>
        )}
      </Animated.View>

      <Sheet visible={adding} onClose={() => setAdding(false)} title={t('scan.addItem')}>
        <View style={styles.grid}>
          {KEYS.map((k) => (
            <PressableScale key={k} onPress={() => add(k)} accessibilityRole="button" style={[styles.tile, { backgroundColor: colors.surface }]}>
              <View style={[styles.tileIcon, { borderColor: colors.primaryFill, backgroundColor: colors.control }]}>
                <MaterialCommunityIcons name={CATALOG[k].icon} size={24} color={colors.primary} />
              </View>
              <Text variant="caption" center>
                {t(`scan.items.${k}`)}
              </Text>
            </PressableScale>
          ))}
        </View>
      </Sheet>
    </View>
  );
}

/** A small picture of one item, cut out of the photo around its box. */
function Thumb({ item, photo, size }: { item: Item; photo?: Photo; size: { w: number; h: number } }) {
  const colors = useColors();
  const TW = 64;
  const TH = 56;
  if (!item.box || !photo) {
    return (
      <View style={[styles.thumbBox, { width: TW, height: TH, backgroundColor: colors.control }]}>
        <MaterialCommunityIcons name={CATALOG[item.key].icon} size={26} color={colors.primary} />
      </View>
    );
  }
  const b = item.box;
  const s = Math.max(TW / (b.w * size.w), TH / (b.h * size.h));
  const w = size.w * s;
  const h = size.h * s;
  return (
    <View style={[styles.thumbBox, { width: TW, height: TH, backgroundColor: colors.control }]}>
      <Image source={photo.sample ? SAMPLE : { uri: photo.uri }} style={{ position: 'absolute', width: w, height: h, left: -b.x * w + (TW - b.w * w) / 2, top: -b.y * h + (TH - b.h * h) / 2 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  photo: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden', backgroundColor: '#000000' },
  shadeTop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.18)' },
  shadeBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 0 },
  sweep: { position: 'absolute', left: 0, right: 0, height: 4, opacity: 0.9, borderRadius: 2 },
  outline: { position: 'absolute', borderWidth: 1.5, borderRadius: 22, shadowOpacity: 0.6, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  chip: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, paddingStart: 5, paddingEnd: 12, borderRadius: 16, borderWidth: 1 },
  chipIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontWeight: '700', lineHeight: 18 },
  chipSub: { fontSize: 12, lineHeight: 14 },
  analysing: { position: 'absolute', left: 0, right: 0, top: '42%', alignItems: 'center' },
  hello: { position: 'absolute', left: Spacing.xl, right: Spacing.xl, top: 64 },
  stroke: { width: 70, height: 5, borderRadius: 3, marginTop: 6 },
  top: { position: 'absolute', top: Spacing.md, left: Spacing.lg, right: Spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  glass: { backgroundColor: 'rgba(28,28,30,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  round: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: Radius.pill },
  controls: { position: 'absolute', left: Spacing.xl, right: Spacing.xl, bottom: Spacing.lg, alignItems: 'center', gap: 12 },
  thumbs: { flexDirection: 'row', gap: 6 },
  thumb: { width: 44, height: 44, borderRadius: 12, borderWidth: 2, borderColor: '#FFFFFF' },
  tip: { backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 4, borderRadius: Radius.pill },
  row: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 86, height: 86, borderRadius: 43, borderWidth: 4, borderColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  shutterInner: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.7, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } },
  skip: { textDecorationLine: 'underline', paddingVertical: 4 },
  panel: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1 },
  grab: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: Radius.lg },
  thumbBox: { borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.pill, padding: 3 },
  stepBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  del: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  addMore: { height: 52, borderRadius: Radius.pill, borderWidth: 1.5, borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  total: { marginHorizontal: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.lg },
  actions: { flexDirection: 'row', gap: 10, padding: Spacing.lg, paddingTop: Spacing.md },
  btn: { height: 56, borderRadius: Radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: Spacing.lg },
  tile: { width: '31%', borderRadius: Radius.lg, paddingVertical: 14, alignItems: 'center', gap: 8 },
  tileIcon: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
