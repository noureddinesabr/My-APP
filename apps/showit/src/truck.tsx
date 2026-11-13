import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

import { useT } from './i18n';
import { useColors } from './ui';

/**
 * A small truck driving next to the first page's title (owner's request): an orange cargo box with
 * the Xapp mark, a dark cab with a lit window and headlight, turning wheels, a gentle bounce, speed
 * lines behind it and the road sliding past. It faces the way the language reads (to the right in
 * English/French, to the left in Arabic). Drawn with plain views (no image), so it stays sharp and
 * light; every movement uses the native driver.
 */
const W = 124;
const H = 76;
const SCALE = 0.84;
export function MovingTruck() {
  const c = useColors();
  const { rtl } = useT();
  const road = useRef(new Animated.Value(0)).current;
  const wheel = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const wind = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loops = [
      Animated.loop(Animated.timing(road, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(Animated.timing(wheel, { toValue: 1, duration: 520, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounce, { toValue: 1, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(bounce, { toValue: 0, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 1100, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0.35, duration: 1100, useNativeDriver: true }),
        ]),
      ),
      Animated.loop(Animated.timing(wind, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true })),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [road, wheel, bounce, glow, wind]);

  const spin = wheel.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const lift = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -1.6] });
  const dash = road.interpolate({ inputRange: [0, 1], outputRange: [0, -28] });
  const Wheel = ({ left }: { left: number }) => (
    <View style={{ position: 'absolute', left, bottom: 6, width: 19, height: 19, borderRadius: 10, backgroundColor: '#13141A', alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: '#D6D3CD', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: spin }] }}>
        <View style={{ position: 'absolute', width: 2, height: 11, backgroundColor: '#13141A' }} />
        <View style={{ position: 'absolute', width: 11, height: 2, backgroundColor: '#13141A' }} />
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: c.accent }} />
      </Animated.View>
    </View>
  );
  return (
    // Drawn at 124 × 76 and shown at 84 % (104 × 64), so the title beside it keeps its room.
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: Math.round(W * SCALE), height: Math.round(H * SCALE), transform: rtl ? [{ scaleX: -1 }] : [] }}>
    <View style={{ position: 'absolute', width: W, height: H, left: (W * SCALE - W) / 2, top: (H * SCALE - H) / 2, transform: [{ scale: SCALE }] }}>
      {/* A soft sun behind, in the page's warm colour. */}
      <View style={{ position: 'absolute', right: 6, top: 2, width: 46, height: 46, borderRadius: 23, backgroundColor: c.accent, opacity: 0.12 }} />
      {/* The road: a line with dashes sliding backwards. */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 4, height: 3, borderRadius: 2, backgroundColor: c.line }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, overflow: 'hidden' }}>
        <Animated.View style={{ flexDirection: 'row', gap: 14, transform: [{ translateX: dash }] }}>
          {Array.from({ length: 8 }, (_, i) => (
            <View key={i} style={{ width: 14, height: 3, borderRadius: 2, backgroundColor: c.muted, opacity: 0.45 }} />
          ))}
        </Animated.View>
      </View>
      {/* Speed lines behind the truck. */}
      {[14, 26, 38].map((top, i) => (
        <Animated.View
          key={top}
          style={{
            position: 'absolute',
            left: 2 + i * 3,
            top,
            width: 16 - i * 3,
            height: 2.5,
            borderRadius: 2,
            backgroundColor: c.accent,
            opacity: wind.interpolate({ inputRange: [0, 1], outputRange: [0.75, 0] }),
            transform: [{ translateX: wind.interpolate({ inputRange: [0, 1], outputRange: [8, -6] }) }],
          }}
        />
      ))}
      <Animated.View style={{ position: 'absolute', left: 20, bottom: 9, width: 96, height: 52, transform: [{ translateY: lift }] }}>
        {/* Cargo box: orange, a lighter top edge, the Xapp mark. */}
        <View style={{ position: 'absolute', left: 0, bottom: 8, width: 62, height: 42, borderRadius: 7, backgroundColor: c.accent, overflow: 'hidden' }}>
          <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.22)' }} />
          <View style={{ position: 'absolute', left: 8, right: 8, bottom: 9, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.25)' }} />
          <View style={{ position: 'absolute', left: 22, top: 14, width: 18, height: 18, borderRadius: 5, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ position: 'absolute', width: 12, height: 3, borderRadius: 2, backgroundColor: '#13141A', transform: [{ rotate: '45deg' }] }} />
            <View style={{ position: 'absolute', width: 12, height: 3, borderRadius: 2, backgroundColor: c.accent, transform: [{ rotate: '-45deg' }] }} />
          </View>
        </View>
        {/* Cab: dark, rounded nose, a lit window and a headlight. */}
        <View style={{ position: 'absolute', left: 63, bottom: 8, width: 30, height: 32, borderTopLeftRadius: 5, borderTopRightRadius: 13, borderBottomRightRadius: 5, backgroundColor: '#1F2028' }}>
          <View style={{ position: 'absolute', left: 6, top: 5, width: 17, height: 11, borderTopRightRadius: 8, borderRadius: 3, backgroundColor: '#BFE3F2' }} />
          <View style={{ position: 'absolute', right: -1, bottom: 5, width: 5, height: 5, borderRadius: 3, backgroundColor: '#FCD34D' }} />
        </View>
        {/* The headlight's glow on the road ahead. */}
        <Animated.View style={{ position: 'absolute', left: 94, bottom: 8, width: 16, height: 9, borderTopRightRadius: 9, borderBottomRightRadius: 9, backgroundColor: '#FCD34D', opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }) }} />
        {/* Chassis line under the box and cab. */}
        <View style={{ position: 'absolute', left: 2, right: 4, bottom: 7, height: 3, borderRadius: 2, backgroundColor: '#13141A' }} />
        <Wheel left={8} />
        <Wheel left={38} />
        <Wheel left={70} />
      </Animated.View>
    </View>
    </View>
  );
}
