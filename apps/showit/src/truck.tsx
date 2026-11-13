import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, View, type ViewStyle } from 'react-native';

import { useT } from './i18n';
import { useColors } from './ui';

/**
 * The vehicles driving next to the first page's title (owner's request): the box truck, the large
 * van (Transit type), the small van (Kangoo type), the pickup, the light flatbed truck and the cargo
 * tricycle (triporteur) take turns. Each drives in from behind, rolls in place for a moment (wheels
 * turning, road sliding, speed lines, a gentle bounce, the headlight glowing), then drives off ahead
 * and the next one follows; after the last, the first comes back. They face the way the language
 * reads (to the right in English/French, to the left in Arabic). Drawn with plain views on a
 * 300 × 184 sketch, shown at 104 × 64; every movement uses the native driver.
 */
const SW = 300;
const SH = 184;
const OUT_W = 104;
const OUT_H = 64;
const K = OUT_W / SW;

const ACC = '#C2410C';
const CAB = '#272833';
const GLASS = '#BFE3F2';
const GLASS2 = '#9CC9DC';
const INK = '#13141A';
const LIGHT = '#FCD34D';
const BUMPER = '#9A9894';
const REAR = '#B91C1C';
const CRATE = '#E8D2B0';
const CRATE_EDGE = '#C9AE86';

type Shared = { spin: Animated.AnimatedInterpolation<string>; glow: Animated.Value; bg: string };

/** A box positioned on the sketch (bottom-based, like the drawings). */
const B = ({ s, children }: { s: ViewStyle; children?: ReactNode }) => <View style={[{ position: 'absolute' }, s]}>{children}</View>;

function Wheel({ x, spin }: { x: number; spin: Shared['spin'] }) {
  return (
    <B s={{ left: x, bottom: 14, width: 58, height: 58, borderRadius: 29, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#D9D6CF', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: spin }] }}>
        <View style={{ position: 'absolute', width: 5, height: 34, backgroundColor: '#6B6A66' }} />
        <View style={{ position: 'absolute', width: 34, height: 5, backgroundColor: '#6B6A66' }} />
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: ACC }} />
      </Animated.View>
    </B>
  );
}
const Arch = ({ x, bg }: { x: number; bg: string }) => <B s={{ left: x - 7, bottom: 44, width: 72, height: 36, borderTopLeftRadius: 36, borderTopRightRadius: 36, backgroundColor: bg }} />;
const Mark = ({ l, t }: { l: number; t: number }) => (
  <B s={{ left: l, top: t, width: 46, height: 46, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ position: 'absolute', width: 30, height: 7, borderRadius: 4, backgroundColor: INK, transform: [{ rotate: '45deg' }] }} />
    <View style={{ position: 'absolute', width: 30, height: 7, borderRadius: 4, backgroundColor: ACC, transform: [{ rotate: '-45deg' }] }} />
  </B>
);
const Glare = ({ l, t }: { l: number; t: number }) => <B s={{ left: l, top: t, width: 6, height: 22, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.75)', transform: [{ rotate: '20deg' }] }} />;
const Crate = ({ l, b, w, h }: { l: number; b: number; w: number; h: number }) => <B s={{ left: l, bottom: b, width: w, height: h, borderRadius: 4, backgroundColor: CRATE, borderWidth: 2, borderColor: CRATE_EDGE }} />;
const Glow = ({ l, b, glow }: { l: number; b: number; glow: Animated.Value }) => (
  <Animated.View style={{ position: 'absolute', left: l, bottom: b, width: 30, height: 18, borderTopRightRadius: 18, borderBottomRightRadius: 18, backgroundColor: LIGHT, opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }) }} />
);
const Shadow = ({ l, r }: { l: number; r: number }) => <B s={{ left: l, right: r, bottom: 16, height: 12, borderRadius: 6, backgroundColor: '#000000', opacity: 0.14 }} />;

/** 1 · Box truck: orange cargo box, dark cab with a big windshield, door, headlight, bumper. */
function BoxTruck({ spin, glow, bg }: Shared) {
  return (
    <>
      <Shadow l={48} r={14} />
      <B s={{ left: 36, bottom: 40, width: 154, height: 112, borderRadius: 14, backgroundColor: ACC, overflow: 'hidden' }}>
        <View style={{ height: 12, backgroundColor: 'rgba(255,255,255,0.25)' }} />
        <B s={{ left: 0, right: 0, bottom: 20, height: 7, backgroundColor: 'rgba(255,255,255,0.3)' }} />
        <Mark l={54} t={30} />
        <B s={{ left: 0, bottom: 34, width: 7, height: 17, backgroundColor: REAR }} />
      </B>
      <B s={{ left: 194, bottom: 40, width: 78, height: 86, borderTopLeftRadius: 10, borderTopRightRadius: 24, borderBottomRightRadius: 7, backgroundColor: CAB }}>
        <B s={{ right: 5, top: 9, width: 36, height: 36, borderRadius: 5, borderTopRightRadius: 19, backgroundColor: GLASS, transform: [{ skewX: '-12deg' }] }}>
          <Glare l={7} t={5} />
        </B>
        <B s={{ left: 9, top: 9, width: 22, height: 29, borderRadius: 5, backgroundColor: GLASS2 }} />
        <B s={{ left: 7, top: 5, width: 38, height: 72, borderRadius: 7, borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)' }} />
        <B s={{ right: -2, bottom: 17, width: 12, height: 14, borderRadius: 4, backgroundColor: LIGHT }} />
        <B s={{ right: -7, bottom: 0, width: 24, height: 12, borderRadius: 4, backgroundColor: BUMPER }} />
      </B>
      <Glow l={272} b={56} glow={glow} />
      <B s={{ left: 40, right: 30, bottom: 34, height: 9, borderRadius: 4, backgroundColor: INK }} />
      <Arch x={60} bg={bg} />
      <Arch x={203} bg={bg} />
      <Wheel x={60} spin={spin} />
      <Wheel x={203} spin={spin} />
    </>
  );
}

/** 2 · Large van (Transit type): one long body, big slanted windshield, short nose, sliding door. */
function LargeVan({ spin, glow, bg }: Shared) {
  return (
    <>
      <Shadow l={44} r={14} />
      <B s={{ left: 30, bottom: 40, width: 206, height: 108, borderTopLeftRadius: 16, borderTopRightRadius: 30, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, backgroundColor: ACC, overflow: 'hidden' }}>
        <View style={{ height: 12, backgroundColor: 'rgba(255,255,255,0.25)' }} />
        <B s={{ left: 0, right: 0, bottom: 22, height: 7, backgroundColor: 'rgba(255,255,255,0.3)' }} />
        <Mark l={58} t={30} />
        <B s={{ left: 118, top: 14, width: 2, height: 78, backgroundColor: 'rgba(0,0,0,0.18)' }} />
        <B s={{ left: 126, top: 16, width: 28, height: 30, borderRadius: 5, backgroundColor: GLASS2 }} />
        <B s={{ left: 136, top: 56, width: 12, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.7)' }} />
        <B s={{ left: 0, bottom: 38, width: 7, height: 20, backgroundColor: REAR }} />
      </B>
      <B s={{ left: 200, bottom: 94, width: 40, height: 44, borderRadius: 4, borderTopLeftRadius: 6, borderTopRightRadius: 26, backgroundColor: GLASS, transform: [{ skewX: '-24deg' }] }}>
        <Glare l={10} t={7} />
      </B>
      <B s={{ left: 226, bottom: 40, width: 46, height: 56, borderTopLeftRadius: 4, borderTopRightRadius: 22, borderBottomRightRadius: 8, borderBottomLeftRadius: 4, backgroundColor: ACC }} />
      <B s={{ left: 262, bottom: 64, width: 14, height: 13, borderRadius: 4, backgroundColor: LIGHT }} />
      <B s={{ left: 258, bottom: 40, width: 24, height: 12, borderRadius: 4, backgroundColor: BUMPER }} />
      <B s={{ left: 236, bottom: 94, width: 6, height: 16, borderRadius: 2, backgroundColor: INK }} />
      <Glow l={274} b={62} glow={glow} />
      <Arch x={56} bg={bg} />
      <Arch x={206} bg={bg} />
      <Wheel x={56} spin={spin} />
      <Wheel x={206} spin={spin} />
    </>
  );
}

/** 3 · Small van (Kangoo type): shorter, rounder, a sliding-door line. */
function SmallVan({ spin, glow, bg }: Shared) {
  return (
    <>
      <Shadow l={64} r={22} />
      <B s={{ left: 50, bottom: 40, width: 170, height: 92, borderTopLeftRadius: 18, borderTopRightRadius: 46, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, backgroundColor: ACC, overflow: 'hidden' }}>
        <View style={{ height: 10, backgroundColor: 'rgba(255,255,255,0.25)' }} />
        <Mark l={28} t={14} />
        <B s={{ left: 92, top: 12, width: 40, height: 30, borderRadius: 4, borderTopLeftRadius: 6, borderTopRightRadius: 16, backgroundColor: GLASS2 }} />
        <B s={{ left: 88, top: 12, width: 2, height: 70, backgroundColor: 'rgba(0,0,0,0.18)' }} />
        <B s={{ left: 100, top: 52, width: 12, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.7)' }} />
        <B s={{ left: 0, bottom: 30, width: 7, height: 18, backgroundColor: REAR }} />
      </B>
      <B s={{ left: 180, bottom: 86, width: 42, height: 38, borderRadius: 4, borderTopLeftRadius: 6, borderTopRightRadius: 30, backgroundColor: GLASS, transform: [{ skewX: '-30deg' }] }}>
        <Glare l={12} t={6} />
      </B>
      <B s={{ left: 204, bottom: 40, width: 56, height: 46, borderTopLeftRadius: 4, borderTopRightRadius: 26, borderBottomRightRadius: 10, borderBottomLeftRadius: 4, backgroundColor: ACC }} />
      <B s={{ left: 248, bottom: 62, width: 14, height: 12, borderRadius: 4, backgroundColor: LIGHT }} />
      <B s={{ left: 244, bottom: 40, width: 24, height: 12, borderRadius: 4, backgroundColor: BUMPER }} />
      <Glow l={260} b={59} glow={glow} />
      <Arch x={70} bg={bg} />
      <Arch x={196} bg={bg} />
      <Wheel x={70} spin={spin} />
      <Wheel x={196} spin={spin} />
    </>
  );
}

/** 4 · Pickup: an orange cab with a hood, an open bed carrying boxes. */
function Pickup({ spin, glow, bg }: Shared) {
  return (
    <>
      <Shadow l={40} r={14} />
      <Crate l={40} b={88} w={40} h={34} />
      <Crate l={84} b={88} w={30} h={24} />
      <B s={{ left: 28, bottom: 40, width: 120, height: 52, borderRadius: 6, backgroundColor: ACC }}>
        <B s={{ left: 0, right: 0, top: 0, height: 9, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: 'rgba(255,255,255,0.25)' }} />
        <B s={{ left: 0, bottom: 16, width: 7, height: 16, backgroundColor: REAR }} />
      </B>
      <B s={{ left: 148, bottom: 40, width: 68, height: 104, borderTopLeftRadius: 12, borderTopRightRadius: 30, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: ACC }}>
        <B s={{ left: 22, top: 12, width: 36, height: 40, borderRadius: 4, borderTopRightRadius: 22, backgroundColor: GLASS, transform: [{ skewX: '-18deg' }] }}>
          <Glare l={9} t={6} />
        </B>
        <B s={{ left: 6, top: 12, width: 14, height: 36, borderRadius: 4, backgroundColor: GLASS2 }} />
        <B s={{ left: 22, top: 66, width: 12, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.7)' }} />
      </B>
      <B s={{ left: 210, bottom: 40, width: 62, height: 56, borderTopLeftRadius: 4, borderTopRightRadius: 20, borderBottomRightRadius: 10, borderBottomLeftRadius: 4, backgroundColor: ACC }} />
      <B s={{ left: 262, bottom: 68, width: 14, height: 12, borderRadius: 4, backgroundColor: LIGHT }} />
      <B s={{ left: 256, bottom: 40, width: 26, height: 12, borderRadius: 4, backgroundColor: BUMPER }} />
      <Glow l={274} b={65} glow={glow} />
      <Arch x={56} bg={bg} />
      <Arch x={206} bg={bg} />
      <Wheel x={56} spin={spin} />
      <Wheel x={206} spin={spin} />
    </>
  );
}

/** 5 · Light flatbed truck (Dongfeng Captain type): dark cab-over cab, boxes on a flat bed. */
function Flatbed({ spin, glow, bg }: Shared) {
  return (
    <>
      <Shadow l={40} r={14} />
      <Crate l={38} b={68} w={58} h={50} />
      <Crate l={100} b={68} w={44} h={38} />
      <Crate l={148} b={68} w={34} h={26} />
      <B s={{ left: 30, bottom: 44, width: 160, height: 26, borderRadius: 4, backgroundColor: ACC }}>
        <B s={{ left: 6, right: 6, top: 8, height: 4, backgroundColor: 'rgba(255,255,255,0.35)' }} />
        <B s={{ left: 0, top: 6, width: 7, height: 14, backgroundColor: REAR }} />
      </B>
      <B s={{ left: 30, bottom: 70, width: 6, height: 40, backgroundColor: ACC }} />
      <B s={{ left: 194, bottom: 40, width: 80, height: 96, borderTopLeftRadius: 10, borderTopRightRadius: 24, borderBottomRightRadius: 7, backgroundColor: CAB }}>
        <B s={{ right: 5, top: 9, width: 38, height: 38, borderRadius: 5, borderTopRightRadius: 19, backgroundColor: GLASS, transform: [{ skewX: '-12deg' }] }}>
          <Glare l={7} t={5} />
        </B>
        <B s={{ left: 9, top: 9, width: 22, height: 30, borderRadius: 5, backgroundColor: GLASS2 }} />
        <B s={{ right: -2, bottom: 17, width: 12, height: 14, borderRadius: 4, backgroundColor: LIGHT }} />
        <B s={{ right: -7, bottom: 0, width: 24, height: 12, borderRadius: 4, backgroundColor: BUMPER }} />
      </B>
      <Glow l={274} b={56} glow={glow} />
      <Arch x={60} bg={bg} />
      <Arch x={204} bg={bg} />
      <Wheel x={60} spin={spin} />
      <Wheel x={204} spin={spin} />
    </>
  );
}

/** 6 · Cargo tricycle (triporteur): a small round cab, boxes on the back. */
function Tricycle({ spin, glow }: Shared) {
  return (
    <>
      <Shadow l={70} r={40} />
      <Crate l={66} b={84} w={46} h={40} />
      <Crate l={116} b={84} w={34} h={28} />
      <B s={{ left: 56, bottom: 60, width: 108, height: 26, borderRadius: 4, backgroundColor: ACC }}>
        <B s={{ left: 6, right: 6, top: 8, height: 4, backgroundColor: 'rgba(255,255,255,0.35)' }} />
        <B s={{ left: 0, top: 6, width: 7, height: 14, backgroundColor: REAR }} />
      </B>
      <B s={{ left: 166, bottom: 56, width: 70, height: 98, borderTopLeftRadius: 14, borderTopRightRadius: 34, borderBottomRightRadius: 10, borderBottomLeftRadius: 6, backgroundColor: ACC }}>
        <B s={{ left: 20, top: 12, width: 40, height: 42, borderRadius: 6, borderTopRightRadius: 26, backgroundColor: GLASS, transform: [{ skewX: '-14deg' }] }}>
          <Glare l={10} t={6} />
        </B>
        <B s={{ right: -2, bottom: 22, width: 12, height: 12, borderRadius: 4, backgroundColor: LIGHT }} />
      </B>
      <Glow l={236} b={74} glow={glow} />
      <B s={{ left: 96, bottom: 42, width: 150, height: 8, borderRadius: 4, backgroundColor: INK }} />
      <Wheel x={82} spin={spin} />
      <Wheel x={212} spin={spin} />
    </>
  );
}

const FLEET = [BoxTruck, LargeVan, SmallVan, Pickup, Flatbed, Tricycle];
/** How long each vehicle drives in, stays, and drives off (ms). */
const IN = 900;
const STAY = 1500;
const OFF = 800;

export function MovingTruck() {
  const c = useColors();
  const { rtl } = useT();
  const road = useRef(new Animated.Value(0)).current;
  const wheel = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const wind = useRef(new Animated.Value(0)).current;
  const pass = useRef(new Animated.Value(-1)).current;
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const loops = [
      Animated.loop(Animated.timing(road, { toValue: 1, duration: 700, easing: Easing.linear, useNativeDriver: true })),
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
    // One vehicle after the other: in from behind, a moment in place, off ahead; then the next.
    let dead = false;
    const run = (k: number) => {
      if (dead) return;
      pass.setValue(-1);
      setIndex(k);
      Animated.sequence([
        Animated.timing(pass, { toValue: 0, duration: IN, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.delay(STAY),
        Animated.timing(pass, { toValue: 1, duration: OFF, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(({ finished }) => finished && run((k + 1) % FLEET.length));
    };
    run(0);
    return () => {
      dead = true;
      pass.stopAnimation();
      loops.forEach((l) => l.stop());
    };
  }, [road, wheel, bounce, glow, wind, pass]);

  const spin = wheel.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const lift = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const dash = road.interpolate({ inputRange: [0, 1], outputRange: [0, -40] });
  const drive = pass.interpolate({ inputRange: [-1, 0, 1], outputRange: [-SW, 0, SW] });
  const Vehicle = FLEET[index];
  return (
    // Mirrored as a whole in Arabic, so the vehicles drive the way the page reads.
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: OUT_W, height: OUT_H, overflow: 'hidden', transform: rtl ? [{ scaleX: -1 }] : [] }}>
      <View style={{ position: 'absolute', width: SW, height: SH, left: (OUT_W - SW) / 2, top: (OUT_H - SH) / 2, transform: [{ scale: K }] }}>
        {/* The warm sun, the road and its dashes sliding backwards. */}
        <B s={{ right: 14, top: 6, width: 110, height: 110, borderRadius: 55, backgroundColor: c.accent, opacity: 0.12 }} />
        <B s={{ left: 0, right: 0, bottom: 6, height: 18, borderRadius: 9, backgroundColor: c.raised }} />
        <B s={{ left: 0, right: 0, bottom: 13, height: 4, overflow: 'hidden' }}>
          <Animated.View style={{ flexDirection: 'row', gap: 12, transform: [{ translateX: dash }] }}>
            {Array.from({ length: 10 }, (_, i) => (
              <View key={i} style={{ width: 28, height: 4, borderRadius: 2, backgroundColor: c.muted, opacity: 0.5 }} />
            ))}
          </Animated.View>
        </B>
        {/* Speed lines behind. */}
        {[52, 78, 104].map((top, i) => (
          <Animated.View
            key={top}
            style={{
              position: 'absolute',
              left: 4 + i * 8,
              top,
              width: 40 - i * 10,
              height: 6,
              borderRadius: 3,
              backgroundColor: c.accent,
              opacity: wind.interpolate({ inputRange: [0, 1], outputRange: [0.75 - i * 0.15, 0] }),
              transform: [{ translateX: wind.interpolate({ inputRange: [0, 1], outputRange: [16, -12] }) }],
            }}
          />
        ))}
        {/* The vehicle of the moment, driving in, bouncing gently, driving off. */}
        <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: SW, height: SH, transform: [{ translateX: drive }, { translateY: lift }] }}>
          <Vehicle spin={spin} glow={glow} bg={c.bg} />
        </Animated.View>
      </View>
    </View>
  );
}
