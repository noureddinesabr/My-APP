import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, { FadeInLeft, FadeInRight, interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Glass } from '@/components/glass';
import { Avatar, LevelBadge } from '@/components/live/parts';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Text } from '@/components/text';
import { useMyRecord } from '@/components/use-my-record';
import { nativeSwap, physical } from '@/i18n/direction';
import { useDirectionStyle, useLanguage } from '@/i18n/language-provider';
import { LANGUAGE_NAMES } from '@/i18n/languages';
import { haptic } from '@/lib/haptics';
import { Springs } from '@/lib/motion';
import { levelFor } from '@/lib/trip';
import { useAccount } from '@/state/account';
import { useRole } from '@/state/role';
import { Radius, rim, softShadow, Spacing, useColors } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Item = { key: string; icon: IconName; label: string; value?: string; href?: Href; onPress?: () => void; badge?: number };

const DRAWER_MAX = 340;

/**
 * The ☰ button that opens the app menu. It sits in the top start corner:
 * top-left in English and French, top-right in Arabic.
 */
export function MenuButton({ badge = 0 }: { badge?: number }) {
  const { t } = useTranslation();
  const colors = useColors();
  const [open, setOpen] = useState(false);
  return (
    <>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('menu.open')}
        scaleTo={0.9}
        feedback="selection"
        onPress={() => setOpen(true)}
        style={[styles.round, softShadow(colors.shadow, 1)]}>
        <Glass style={styles.menuButton} thickness="thick">
          <Ionicons name="menu" size={26} color={colors.text} />
          {badge > 0 && <View style={[styles.dot, { backgroundColor: colors.accentFill, borderColor: colors.surfaceFloating }]} />}
        </Glass>
      </PressableScale>
      <MenuDrawer visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

function MenuDrawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width: screen } = useWindowDimensions();
  const { rtl, language } = useLanguage();
  const layerDirection = useDirectionStyle();
  const { role, setRole } = useRole();
  const { signOut } = useAccount();
  const { side, account, driverRecord, clientRecord } = useMyRecord();
  const record = side === 'driver' ? driverRecord : clientRecord;
  const width = Math.min(DRAWER_MAX, screen * 0.84);
  // Slides in from the reading start: the left in French/English, the right in Arabic.
  const direction = rtl ? 1 : -1;
  const [mounted, setMounted] = useState(visible);
  const offset = useSharedValue(width);

  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) offset.set(withSpring(0, Springs.sheet));
    else if (mounted)
      offset.set(
        withSpring(width, Springs.sheet, (finished) => {
          if (finished) scheduleOnRN(setMounted, false);
        }),
      );
  }, [visible, mounted, offset, width]);

  const close = () => {
    haptic('light');
    onClose();
  };

  const pan = usePanGesture({
    activeOffsetX: [-10, 10],
    onUpdate: (event) => {
      'worklet';
      // Only towards the closing edge.
      offset.set(Math.max(0, event.translationX * direction));
    },
    onDeactivate: (event) => {
      'worklet';
      const moved = event.translationX * direction;
      if (moved > width * 0.3 || event.velocityX * direction > 700) {
        offset.set(withSpring(width, { ...Springs.sheet, velocity: event.velocityX * direction }));
        scheduleOnRN(close);
      } else offset.set(withSpring(0, Springs.sheet));
    },
  });

  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() * direction }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: interpolate(offset.get(), [0, width], [1, 0], 'clamp') }));

  const go = (href: Href) => {
    onClose();
    router.push(href);
  };

  const driver = side === 'driver';
  const items: Item[] = driver
    ? [
        { key: 'home', icon: 'home-outline', label: t('menu.home'), href: '/driver' },
        { key: 'history', icon: 'time-outline', label: t('menu.driverHistory'), href: '/history' },
        { key: 'bookings', icon: 'calendar-outline', label: t('menu.bookings'), href: { pathname: '/history', params: { tab: 'bookings' } } },
        { key: 'wallet', icon: 'wallet-outline', label: t('menu.wallet'), href: { pathname: '/history', params: { tab: 'wallet' } } },
        { key: 'vehicle', icon: 'car-outline', label: t('menu.vehicle'), href: '/driver-vehicle' },
        { key: 'documents', icon: 'document-text-outline', label: t('menu.documents'), href: '/driver-documents' },
      ]
    : [
        { key: 'home', icon: 'home-outline', label: t('menu.home'), href: '/client' },
        { key: 'new', icon: 'add-circle-outline', label: t('menu.newRequest'), href: '/request' },
        { key: 'history', icon: 'time-outline', label: t('menu.clientHistory'), href: '/history' },
        { key: 'places', icon: 'bookmark-outline', label: t('menu.savedPlaces'), href: '/profile' },
      ];
  const common: Item[] = [
    { key: 'profile', icon: 'person-circle-outline', label: t('menu.profile'), href: '/profile' },
    { key: 'settings', icon: 'settings-outline', label: t('menu.settings'), href: '/settings' },
    { key: 'language', icon: 'globe-outline', label: t('menu.language'), value: LANGUAGE_NAMES[language], href: '/language' },
    {
      key: 'switch',
      icon: 'swap-horizontal-outline',
      label: driver ? t('menu.switchToClient') : t('menu.switchToDriver'),
      onPress: () => {
        onClose();
        const next = role === 'driver' ? 'client' : 'driver';
        setRole(next);
        router.replace(`/${next}`);
      },
    },
  ];

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <GestureHandlerRootView style={[{ flex: 1 }, layerDirection]}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={t('menu.close')} onPress={close} />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View
            accessibilityViewIsModal
            style={[
              styles.panel,
              { [physical(rtl ? 'right' : 'left')]: 0 },
              { width, backgroundColor: colors.surfaceRaised, paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.md },
              rtl !== nativeSwap ? styles.panelRight : styles.panelLeft,
              rim(colors),
              panelStyle,
            ]}>
            <ScrollView contentContainerStyle={{ gap: Spacing.md, paddingHorizontal: Spacing.md }}>
              {/* Who is signed in */}
              <PressableScale
                accessibilityRole="button"
                scaleTo={0.98}
                onPress={() => (account ? go('/profile') : go({ pathname: '/login', params: { role: side } }))}
                style={[styles.profile, { backgroundColor: colors.surface }, rim(colors)]}>
                <Avatar name={account?.name ?? '?'} photo={record?.photo ?? null} size={56} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="subtitle" numberOfLines={1}>
                    {account?.name ?? t('menu.signIn')}
                  </Text>
                  {account ? (
                    <>
                      <Text variant="caption" muted style={{ writingDirection: 'ltr', textAlign: rtl ? 'right' : 'left' }}>
                        {account.phone}
                      </Text>
                      {record && (
                        <View style={styles.row}>
                          <Ionicons name="star" size={13} color={colors.star} />
                          <Text variant="caption">{record.ratingCount ? record.rating.toFixed(1) : '–'}</Text>
                          <LevelBadge level={levelFor(record.trips, record.rating)} />
                        </View>
                      )}
                    </>
                  ) : (
                    <Text variant="caption" muted>
                      {t('menu.signInHint')}
                    </Text>
                  )}
                </View>
              </PressableScale>

              <Text variant="caption" muted style={styles.section}>
                {driver ? t('menu.sectionDriver') : t('menu.sectionClient')}
              </Text>
              <View style={[styles.group, { backgroundColor: colors.surface }, rim(colors)]}>
                {items.map((item, index) => (
                  <MenuRow key={item.key} index={index} item={item} onPress={item.onPress ?? (() => item.href && go(item.href))} />
                ))}
              </View>

              <Text variant="caption" muted style={styles.section}>
                {t('menu.sectionApp')}
              </Text>
              <View style={[styles.group, { backgroundColor: colors.surface }, rim(colors)]}>
                {common.map((item, index) => (
                  <MenuRow key={item.key} index={items.length + index} item={item} onPress={item.onPress ?? (() => item.href && go(item.href))} />
                ))}
              </View>

              {account && (
                <PressableScale
                  accessibilityRole="button"
                  feedback="warning"
                  onPress={() => {
                    onClose();
                    signOut(side);
                  }}
                  style={[styles.signOut, { borderColor: colors.border }]}>
                  <Ionicons name="log-out-outline" size={20} color={colors.accent} />
                  <Text variant="label" color={colors.accent}>
                    {t('menu.signOut')}
                  </Text>
                </PressableScale>
              )}
            </ScrollView>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

function MenuRow({ item, index, onPress }: { item: Item; index: number; onPress: () => void }) {
  const colors = useColors();
  const { rtl } = useLanguage();
  // Rows follow the drawer in from its side, one after another.
  const enter = (rtl ? FadeInRight : FadeInLeft).delay(80 + index * 35).springify().damping(17).stiffness(170);
  return (
    <Animated.View entering={enter}>
    <PressableScale accessibilityRole="button" accessibilityLabel={item.label} scaleTo={0.98} onPress={onPress} style={styles.item}>
      <View style={[styles.itemIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={item.icon} size={20} color={colors.primary} />
      </View>
      <Text variant="label" style={{ flex: 1 }}>
        {item.label}
      </Text>
      {item.value && (
        <Text variant="caption" muted>
          {item.value}
        </Text>
      )}
      <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textMuted} />
    </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  round: { borderRadius: 24 },
  menuButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 10, end: 10, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  panel: { position: 'absolute', top: 0, bottom: 0 },
  panelLeft: { borderTopRightRadius: Radius.xl, borderBottomRightRadius: Radius.xl },
  panelRight: { borderTopLeftRadius: Radius.xl, borderBottomLeftRadius: Radius.xl },
  profile: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  section: { paddingHorizontal: Spacing.sm, marginTop: Spacing.xs },
  group: { borderRadius: Radius.lg, paddingVertical: Spacing.xs },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2 },
  itemIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 52,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
});
