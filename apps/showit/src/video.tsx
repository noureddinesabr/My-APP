import { useVideoPlayer, VideoView } from 'expo-video';
import type { StyleProp, ViewStyle } from 'react-native';

/** A recorded video of the load, with the phone's own play / pause / seek controls. */
export function VideoClip({ uri, style }: { uri: string; style?: StyleProp<ViewStyle> }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  return <VideoView player={player} nativeControls contentFit="cover" style={style} />;
}
