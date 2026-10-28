import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Text } from '@/components/text';
import { useLanguage } from '@/i18n/language-provider';
import { Springs } from '@/lib/motion';
import { Fonts, Radius, softShadow, Spacing, useColors } from '@/theme';

export type NoticeTone = 'primary' | 'success' | 'accent';

/**
 * Looks like a phone notification, so people know at once what it is: the Xapp mark and
 * "now" on top, a bold coloured edge and icon by kind (violet info, green good news, orange
 * needs attention), the title in bold and one line under it. Tap opens it; flick it up or
 * sideways and it goes away.
 */
export function NoticeCard({
  icon,
  title,
  body,
  tone = 'primary',
  onPress,
  onDismiss,
  footer,
}: {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  body?: string;
  tone?: NoticeTone;
  onPress?: () => void;
  onDismiss: () => void;
  /** Extra line inside the card (e.g. a progress bar). */
  footer?: ReactNode;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const { rtl } = useLanguage();
  const fill = tone === 'success' ? colors.successFill : tone === 'accent' ? colors.accentFill : colors.primaryFill;
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  const pan = usePanGesture({
    activeOffsetX: [-10, 10],
    activeOffsetY: [-8, 8],
    onUpdate: (event) => {
      'worklet';
      x.set(event.translationX);
      y.set(Math.min(0, event.translationY));
    },
    onDeactivate: (event) => {
      'worklet';
      const sideways = Math.abs(event.translationX) > 90 || Math.abs(event.velocityX) > 700;
      const up = event.translationY < -30 || event.velocityY < -500;
      if (sideways) x.set(withTiming(Math.sign(event.translationX || 1) * 500, { duration: 220 }, () => scheduleOnRN(onDismiss)));
      else if (up) y.set(withTiming(-220, { duration: 220 }, () => scheduleOnRN(onDismiss)));
      else {
        x.set(withSpring(0, Springs.pop));
        y.set(withSpring(0, Springs.pop));
      }
    },
  });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }],
    opacity: 1 - Math.min(0.8, Math.abs(x.get()) / 400 + Math.abs(y.get()) / 200),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style}>
        <Pressable
          accessibilityRole="alert"
          accessibilityLabel={[title, body].filter(Boolean).join(', ')}
          accessibilityHint={t('notice.hint')}
          onPress={onPress}
          style={[styles.card, { backgroundColor: colors.surfaceFloating, borderColor: fill }, softShadow(colors.shadow, 1.6)]}>
          <View style={[styles.edge, { backgroundColor: fill }]} />
          <View style={styles.top}>
            <View style={[styles.mark, { backgroundColor: colors.primaryFill }]}>
              <Text style={styles.markText} color={colors.onPrimary}>
                X
              </Text>
            </View>
            <Text variant="caption" muted style={styles.app}>
              Xapp · {t('notice.now')}
            </Text>
            <View style={{ flex: 1 }} />
            <MaterialCommunityIcons name="gesture-swipe-horizontal" size={16} color={colors.textMuted} />
          </View>
          <View style={styles.main}>
            <View style={[styles.icon, { backgroundColor: fill }]}>
              <MaterialCommunityIcons name={icon} size={22} color={colors.onPrimary} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text variant="label" style={styles.title}>
                {title}
              </Text>
              {body && (
                <Text variant="caption" muted>
                  {body}
                </Text>
              )}
              {footer}
            </View>
            {onPress && <MaterialCommunityIcons name={rtl ? 'chevron-left' : 'chevron-right'} size={26} color={fill} />}
          </View>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.xl, borderWidth: 2, paddingVertical: Spacing.sm, paddingStart: Spacing.md + 4, paddingEnd: Spacing.md, gap: 6, overflow: 'hidden' },
  edge: { position: 'absolute', top: 0, bottom: 0, start: 0, width: 6 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mark: { width: 18, height: 18, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  markText: { fontFamily: Fonts.extrabold, fontSize: 12, lineHeight: 16 },
  app: { fontSize: 12, lineHeight: 16 },
  main: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: Fonts.bold },
});
