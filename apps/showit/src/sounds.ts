import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

import { getState } from './store';

const FILES = {
  tap: require('../assets/sounds/tap.wav'),
  tick: require('../assets/sounds/tick.wav'),
  pop: require('../assets/sounds/pop.wav'),
  send: require('../assets/sounds/send.wav'),
  offer: require('../assets/sounds/offer.wav'),
  step: require('../assets/sounds/step.wav'),
  success: require('../assets/sounds/success.wav'),
  celebrate: require('../assets/sounds/celebrate.wav'),
};
export type Sound = keyof typeof FILES;

const players: Partial<Record<Sound, AudioPlayer>> = {};

/** Plays a short interface sound; silently does nothing where audio is unavailable. */
export function play(sound: Sound) {
  // Sounds can be switched off in Settings.
  if (getState().sounds === false) return;
  try {
    const player = (players[sound] ??= createAudioPlayer(FILES[sound]));
    player.seekTo(0);
    player.play();
  } catch {
    // no sound on this device
  }
}
