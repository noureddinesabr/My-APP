import { useEffect } from 'react';
import { Image, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import type { VehicleId } from '@/lib/pricing';

/** Turntable sprite strips (all angles side by side), made by scripts/pack-turntables.py. */
const STRIPS: Record<VehicleId, number> = {
  triporteur: require('@/assets/images/vehicles/turn/triporteur.webp'),
  smallVan: require('@/assets/images/vehicles/turn/smallVan.webp'),
  pickup: require('@/assets/images/vehicles/turn/pickup.webp'),
  truck35: require('@/assets/images/vehicles/turn/truck35.webp'),
  truck7: require('@/assets/images/vehicles/turn/truck7.webp'),
  truck12: require('@/assets/images/vehicles/turn/truck12.webp'),
  semi: require('@/assets/images/vehicles/turn/semi.webp'),
  refrigerated: require('@/assets/images/vehicles/turn/refrigerated.webp'),
  flatbed: require('@/assets/images/vehicles/turn/flatbed.webp'),
};

const FRAMES = 36;
/** Frame size in the strips (width : height). */
const ASPECT = 192 / 120;
const TURN_MS = 4800;

/**
 * A vehicle turning round on the spot, in 3D: the rendered angles played one after another.
 * `offset` (0..1) starts it at another angle, so a grid of them doesn't turn in lockstep.
 */
export function TurningVehicle({ vehicle, width, height, offset = 0 }: { vehicle: VehicleId; width: number; height: number; offset?: number }) {
  const frameWidth = Math.min(width, height * ASPECT);
  const frameHeight = frameWidth / ASPECT;
  const turn = useSharedValue(offset);
  useEffect(() => {
    turn.set(offset);
    turn.set(withRepeat(withTiming(offset + 1, { duration: TURN_MS, easing: Easing.linear }), -1, false));
  }, [turn, offset]);
  const strip = useAnimatedStyle(() => {
    const frame = Math.floor((turn.get() % 1) * FRAMES) % FRAMES;
    return { transform: [{ translateX: -frame * frameWidth }] };
  });
  return (
    <View style={{ width: frameWidth, height: frameHeight, overflow: 'hidden' }} pointerEvents="none">
      <Animated.View style={[{ width: frameWidth * FRAMES, height: frameHeight }, strip]}>
        {/* A plain image (loads at once in the browser too, not lazily when scrolled to). */}
        <Image source={STRIPS[vehicle]} style={{ width: frameWidth * FRAMES, height: frameHeight }} resizeMode="stretch" />
      </Animated.View>
    </View>
  );
}
