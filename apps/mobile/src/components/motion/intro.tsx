import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming, ZoomIn } from 'react-native-reanimated';

import { Shimmer } from '@/components/motion/effects';
import { Text } from '@/components/text';
import { Fonts } from '@/theme';

/** Same colour as the phone's splash screen, so the hand-over is seamless. */
const SPLASH = '#1E0B45';
const SHOW_MS = 1500;

/**
 * The app opening like a real product: the Xapp mark springs in where the splash left it,
 * gives a little nudge forward (on the move), the name rises under it, then everything
 * fades into the app. About a second and a half, once per launch.
 */
export function Intro() {
  const { t } = useTranslation();
  const [done, setDone] = useState(false);
  const nudge = useSharedValue(0);
  useEffect(() => {
    nudge.set(withDelay(500, withSequence(withTiming(1, { duration: 180 }), withSpring(0, { damping: 6, stiffness: 160 }))));
    const timer = setTimeout(() => setDone(true), SHOW_MS);
    return () => clearTimeout(timer);
  }, [nudge]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: nudge.get() * 14 }, { translateY: nudge.get() * -14 }] }));
  if (done) return null;
  return (
    <Animated.View exiting={FadeOut.duration(350)} style={[StyleSheet.absoluteFill, styles.wrap]} pointerEvents="none">
      <Animated.View entering={ZoomIn.springify().damping(12).stiffness(140)} style={style}>
        <View style={styles.mark}>
          <Image source={require('@/assets/images/logo-mark.png')} style={styles.image} contentFit="contain" />
          <Shimmer every={900} color="rgba(255,255,255,0.35)" />
        </View>
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(250).springify().damping(14)}>
        <Text style={styles.name} color="#FFFFFF">
          Xapp
        </Text>
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(450).springify().damping(14)}>
        <Text variant="label" color="#DDD6FE" center>
          {t('intro.tagline')}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: SPLASH, alignItems: 'center', justifyContent: 'center', gap: 14, zIndex: 1000 },
  mark: { width: 132, height: 132, borderRadius: 30, overflow: 'hidden' },
  image: { width: 132, height: 132 },
  name: { fontFamily: Fonts.extrabold, fontSize: 44, lineHeight: 60, letterSpacing: -1 },
});
