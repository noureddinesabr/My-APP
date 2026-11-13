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
  // A big wheel: tyre, light rim, spokes turning, an orange hub.
  const Wheel = ({ left }: { left: number }) => (
    <View style={{ position: 'absolute', left, bottom: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: '#13141A', alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#D9D6CF', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: spin }] }}>
        <View style={{ position: 'absolute', width: 2, height: 14, backgroundColor: '#6B6A66' }} />
        <View style={{ position: 'absolute', width: 14, height: 2, backgroundColor: '#6B6A66' }} />
        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c.accent }} />
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
      {/* The truck, like the delivery-truck icon people know: a tall cargo box, a cab with a big
          slanted windshield, a door, a mirror, a headlight and a bumper, and two big wheels under
          their wheel arches. */}
      <View style={{ position: 'absolute', left: 22, right: 4, bottom: 6, height: 5, borderRadius: 3, backgroundColor: '#000000', opacity: 0.16 }} />
      <Animated.View style={{ position: 'absolute', left: 16, bottom: 7, width: 102, height: 60, transform: [{ translateY: lift }] }}>
        {/* Cargo box: orange, a lighter roof edge, a stripe and the Xapp mark. */}
        <View style={{ position: 'absolute', left: 0, bottom: 12, width: 64, height: 46, borderRadius: 6, backgroundColor: c.accent, overflow: 'hidden' }}>
          <View style={{ height: 5, backgroundColor: 'rgba(255,255,255,0.25)' }} />
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 8, height: 3, backgroundColor: 'rgba(255,255,255,0.3)' }} />
          <View style={{ position: 'absolute', left: 22, top: 12, width: 20, height: 20, borderRadius: 6, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ position: 'absolute', width: 13, height: 3, borderRadius: 2, backgroundColor: '#13141A', transform: [{ rotate: '45deg' }] }} />
            <View style={{ position: 'absolute', width: 13, height: 3, borderRadius: 2, backgroundColor: c.accent, transform: [{ rotate: '-45deg' }] }} />
          </View>
          {/* Rear light. */}
          <View style={{ position: 'absolute', left: 0, bottom: 14, width: 3, height: 7, backgroundColor: '#B91C1C' }} />
        </View>
        {/* Cab: dark body, its roof lower than the box, rounded at the front top. */}
        <View style={{ position: 'absolute', left: 66, bottom: 12, width: 32, height: 36, borderTopLeftRadius: 4, borderTopRightRadius: 10, borderBottomRightRadius: 3, backgroundColor: '#272833' }}>
          {/* Big windshield, slanted at the front. */}
          <View style={{ position: 'absolute', right: 2, top: 4, width: 15, height: 15, borderTopRightRadius: 8, borderRadius: 2, backgroundColor: '#BFE3F2', transform: [{ skewX: '-12deg' }] }}>
            <View style={{ position: 'absolute', left: 3, top: 2, width: 3, height: 9, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.75)', transform: [{ rotate: '20deg' }] }} />
          </View>
          {/* Side window and the door outline with its handle. */}
          <View style={{ position: 'absolute', left: 4, top: 4, width: 9, height: 12, borderRadius: 2, backgroundColor: '#9CC9DC' }} />
          <View style={{ position: 'absolute', left: 3, top: 2, width: 16, height: 30, borderRadius: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }} />
          <View style={{ position: 'absolute', left: 13, top: 20, width: 5, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.6)' }} />
          {/* Headlight and the front bumper. */}
          <View style={{ position: 'absolute', right: -1, bottom: 7, width: 5, height: 6, borderRadius: 2, backgroundColor: '#FCD34D' }} />
          <View style={{ position: 'absolute', right: -3, bottom: 0, width: 10, height: 5, borderRadius: 2, backgroundColor: '#9A9894' }} />
        </View>
        {/* Side mirror. */}
        <View style={{ position: 'absolute', left: 82, bottom: 40, width: 3, height: 8, borderRadius: 1, backgroundColor: '#13141A' }} />
        {/* The headlight's glow on the road ahead. */}
        <Animated.View style={{ position: 'absolute', left: 99, bottom: 16, width: 14, height: 9, borderTopRightRadius: 9, borderBottomRightRadius: 9, backgroundColor: '#FCD34D', opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }) }} />
        {/* Chassis, then the wheel arches (page-coloured cut-outs) and the two big wheels. */}
        <View style={{ position: 'absolute', left: 2, right: 6, bottom: 11, height: 4, borderRadius: 2, backgroundColor: '#13141A' }} />
        <View style={{ position: 'absolute', left: 10, bottom: 8, width: 30, height: 15, borderTopLeftRadius: 15, borderTopRightRadius: 15, backgroundColor: c.bg }} />
        <View style={{ position: 'absolute', left: 69, bottom: 8, width: 30, height: 15, borderTopLeftRadius: 15, borderTopRightRadius: 15, backgroundColor: c.bg }} />
        <Wheel left={13} />
        <Wheel left={72} />
      </Animated.View>
    </View>
    </View>
  );
}
