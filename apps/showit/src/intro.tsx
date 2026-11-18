import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useT } from './i18n';
import { play } from './sounds';
import { Backdrop, Glow, T, useColors } from './ui';

const TRUCK = require('../assets/vehicles/truck7.webp');

/**
 * Owner's report #3 (18 Nov 2026): before the camera, a short welcome — the Xapp mark pops in, the
 * name and one line, and a 3D truck drives in along a gradient road. Owner's edit (18 Nov 2026): like
 * the big apps, about four seconds — everything arrives (~1.6 s), the full picture stays still ~2 s,
 * then a gentle fade. A tap skips it.
 */
export function Intro({ onDone }: { onDone: () => void }) {
  const c = useColors();
  const { t, rtl } = useT();
  const { width } = useWindowDimensions();
  const logo = useRef(new Animated.Value(0)).current;
  const words = useRef(new Animated.Value(0)).current;
  const truck = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(1)).current;
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    Animated.timing(out, { toValue: 0, duration: 420, useNativeDriver: true }).start(() => onDone());
  };
  useEffect(() => {
    play('pop');
    Animated.sequence([
      Animated.spring(logo, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(words, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(truck, { toValue: 1, duration: 1100, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true }),
      ]),
    ]).start();
    const timer = setTimeout(finish, 3600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The truck comes in from where the language starts reading.
  const from = (rtl ? 1 : -1) * (width * 0.9);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: out, zIndex: 50, elevation: 50 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Xapp" onPress={finish} style={StyleSheet.absoluteFill}>
        <Backdrop />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 24 }}>
          <Animated.View style={{ opacity: logo, transform: [{ scale: logo.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }, { rotate: logo.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '0deg'] }) }] }}>
            <Glow tone="accent" style={{ width: 108, height: 108, borderRadius: 32, alignItems: 'center', justifyContent: 'center' }}>
              <T size={60} weight="heavy" color={c.onAccent} style={{ lineHeight: 66 }}>
                X
              </T>
            </Glow>
          </Animated.View>
          <Animated.View style={{ alignItems: 'center', gap: 4, opacity: words, transform: [{ translateY: words.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
            <T size={46} weight="heavy">
              Xapp
            </T>
            <T size={16} muted style={{ textAlign: 'center' }}>
              {t('introTagline')}
            </T>
          </Animated.View>
          <View style={{ width: '100%', alignItems: 'center', marginTop: 10 }}>
            <Animated.View style={{ transform: [{ translateX: truck.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }, { scaleX: rtl ? -1 : 1 }] }}>
              <Image source={TRUCK} style={{ width: Math.min(300, width * 0.78), height: Math.min(188, width * 0.49) }} resizeMode="contain" accessibilityIgnoresInvertColors />
            </Animated.View>
            {/* The road: a soft gradient line under the wheels. */}
            <LinearGradient colors={[c.accent, c.accent2, c.accent3]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ width: '82%', height: 6, borderRadius: 3, marginTop: -8, opacity: 0.85 }} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}
