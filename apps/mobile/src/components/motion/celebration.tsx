import { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, ZoomIn } from 'react-native-reanimated';

import { KineticTitle } from '@/components/motion/quest';
import { SuccessBurst } from '@/components/motion/scenes';
import { Text } from '@/components/text';
import { softShadow, useColors } from '@/theme';

/**
 * Full-screen "well done" moment (request sent, driver booked, delivered): the burst, a big
 * word and one short line. It closes by itself after a couple of seconds, or on a tap.
 */
export function Celebration({
  title,
  body,
  onDone,
  duration = 2600,
  overMap,
}: {
  title: string;
  body?: string;
  onDone: () => void;
  duration?: number;
  /** A floating card over the map instead of a full-screen moment: the map stays in full view behind it. */
  overMap?: boolean;
}) {
  const colors = useColors();
  useEffect(() => {
    const timer = setTimeout(onDone, duration);
    return () => clearTimeout(timer);
  }, [onDone, duration]);
  if (overMap) {
    return (
      <Animated.View entering={ZoomIn.springify().damping(13)} exiting={FadeOut.duration(260)} style={styles.floatWrap} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title}
          onPress={onDone}
          style={[styles.card, { backgroundColor: colors.surfaceFloating, borderColor: colors.success }, softShadow(colors.shadow, 1.4)]}>
          <SuccessBurst size={64} />
          <View style={styles.cardText}>
            <Text variant="title" style={{ fontSize: 20, lineHeight: 28 }}>
              {title}
            </Text>
            {body && (
              <Text variant="caption" muted>
                {body}
              </Text>
            )}
          </View>
        </Pressable>
      </Animated.View>
    );
  }
  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(260)} style={[StyleSheet.absoluteFill, styles.wrap, { backgroundColor: `${colors.background}E0` }]}>
      {/* See-through: the app (the map, the trip) stays visible behind the moment. */}
      <LinearGradient colors={[`${colors.backgroundGlow}CC`, 'transparent']} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onDone} style={styles.press}>
        <SuccessBurst />
        <View style={styles.text}>
          <KineticTitle text={title} center />
          {body && (
            <Animated.View entering={FadeInDown.delay(350)}>
              <Text variant="subtitle" muted center>
                {body}
              </Text>
            </Animated.View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { zIndex: 50 },
  press: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { alignItems: 'center', gap: 8, marginTop: -24 },
  floatWrap: { position: 'absolute', top: '12%', left: 0, right: 0, alignItems: 'center', zIndex: 50, paddingHorizontal: 20 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingStart: 4, paddingEnd: 16, borderRadius: 28, borderWidth: 2, width: '100%', maxWidth: 440 },
  cardText: { flex: 1, gap: 2 },
});

/**
 * True once `when` turns true while the screen is open (not if it was already true when the
 * screen opened, so reopening doesn't replay it); `close` hides it again.
 */
export function useBecameTrue(when: boolean) {
  const [previous, setPrevious] = useState(when);
  const [shown, setShown] = useState(false);
  if (previous !== when) {
    setPrevious(when);
    if (when) setShown(true);
  }
  return { shown, close: () => setShown(false) };
}
