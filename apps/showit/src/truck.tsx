import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, View } from 'react-native';

import { useT } from './i18n';
import { useColors } from './ui';

/**
 * A truck driving next to the first page's title (owner's request). It is the real photo of the
 * city mini truck (the same one as in the vehicle list), so people see a truck at a glance; the
 * movement comes from a gentle bounce, a soft shadow, the road sliding past, speed lines and a
 * little dust behind it. It faces the way the language reads (to the right in English/French, to
 * the left in Arabic). Every movement uses the native driver.
 */
const W = 112;
const H = 66;
const TRUCK = require('../assets/vehicles/cityTruck.webp');

export function MovingTruck() {
  const c = useColors();
  const { rtl } = useT();
  const road = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  const wind = useRef(new Animated.Value(0)).current;
  const dust = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loops = [
      Animated.loop(Animated.timing(road, { toValue: 1, duration: 700, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounce, { toValue: 1, duration: 230, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(bounce, { toValue: 0, duration: 230, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ),
      Animated.loop(Animated.timing(wind, { toValue: 1, duration: 650, easing: Easing.out(Easing.quad), useNativeDriver: true })),
      Animated.loop(Animated.timing(dust, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true })),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [road, bounce, wind, dust]);

  const lift = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -1.5] });
  const dash = road.interpolate({ inputRange: [0, 1], outputRange: [0, -24] });
  return (
    // Drawn facing right; mirrored as a whole in Arabic so it drives the way the page reads.
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: W, height: H, transform: rtl ? [{ scaleX: -1 }] : [] }}>
      {/* The road: a soft band with dashes sliding backwards. */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 2, height: 8, borderRadius: 4, backgroundColor: c.raised }} />
      <View style={{ position: 'absolute', left: 4, right: 4, bottom: 5, height: 2, overflow: 'hidden' }}>
        <Animated.View style={{ flexDirection: 'row', gap: 12, transform: [{ translateX: dash }] }}>
          {Array.from({ length: 9 }, (_, i) => (
            <View key={i} style={{ width: 12, height: 2, borderRadius: 1, backgroundColor: c.muted, opacity: 0.55 }} />
          ))}
        </Animated.View>
      </View>
      {/* Speed lines behind, in the page's colour. */}
      {[16, 26, 36].map((top, i) => (
        <Animated.View
          key={top}
          style={{
            position: 'absolute',
            left: i * 3,
            top,
            width: 18 - i * 4,
            height: 2.5,
            borderRadius: 2,
            backgroundColor: c.accent,
            opacity: wind.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
            transform: [{ translateX: wind.interpolate({ inputRange: [0, 1], outputRange: [10, -6] }) }],
          }}
        />
      ))}
      {/* A little dust behind the rear wheel. */}
      <Animated.View
        style={{
          position: 'absolute',
          left: 12,
          bottom: 9,
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: c.muted,
          opacity: dust.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
          transform: [{ translateX: dust.interpolate({ inputRange: [0, 1], outputRange: [6, -10] }) }, { scale: dust.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.6] }) }],
        }}
      />
      {/* The shadow under the truck, then the truck itself (the photo faces left: turned to face right). */}
      <View style={{ position: 'absolute', left: 22, right: 6, bottom: 6, height: 6, borderRadius: 4, backgroundColor: '#000000', opacity: 0.18 }} />
      <Animated.View style={{ position: 'absolute', left: 18, bottom: 7, width: 92, height: 56, transform: [{ translateY: lift }] }}>
        <Image source={TRUCK} style={{ width: 92, height: 56, transform: [{ scaleX: -1 }] }} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}
