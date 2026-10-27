import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { KineticTitle } from '@/components/motion/quest';
import { SuccessBurst } from '@/components/motion/scenes';
import { Text } from '@/components/text';
import { useColors } from '@/theme';

/**
 * Full-screen "well done" moment (request sent, driver booked, delivered): the burst, a big
 * word and one short line. It closes by itself after a couple of seconds, or on a tap.
 */
export function Celebration({ title, body, onDone, duration = 2600 }: { title: string; body?: string; onDone: () => void; duration?: number }) {
  const colors = useColors();
  useEffect(() => {
    const timer = setTimeout(onDone, duration);
    return () => clearTimeout(timer);
  }, [onDone, duration]);
  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(260)} style={[StyleSheet.absoluteFill, styles.wrap, { backgroundColor: colors.background }]}>
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
});
