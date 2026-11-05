import { Ionicons } from '@expo/vector-icons';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Draft } from './ai';
import { COMMON_ITEMS, nearestWeight, type NoteTag } from './choices';
import { useT, type Key } from './i18n';
import { scanLoad, fmtKg, itemId, kgRange, totalKg, type LoadScan, type ScanItem } from './scan';
import { Chip, LoadDrawing, VehiclePicker, VehicleRow, vName } from './shared';
import { play } from './sounds';
import { stillFromVideo } from './still';
import { Btn, Card, T, tap, useColors, useVoiceRecorder, VoicePlayer } from './ui';
import { bestFit, vehicleById, type VehicleId } from './vehicles';
import { VideoClip } from './video';
import { BigMic, SPEECH_LANGS, type SpeechLang } from './voice';

export type Media = {
  photoUri: string;
  photoBase64: string | null;
  videoUri: string;
  voiceUri: string;
  voiceMs: number;
  said: string;
};
export const NO_MEDIA: Media = {
  photoUri: '',
  photoBase64: null,
  videoUri: '',
  voiceUri: '',
  voiceMs: 0,
  said: '',
};

/** The customer's answers to the few questions a photo can't answer. */
export type Answers = {
  floor: '' | 'ground' | '1' | '2' | '3' | '4+';
  lift: '' | 'yes' | 'no';
  all: '' | 'yes';
};
export const NO_ANSWERS: Answers = { floor: '', lift: '', all: '' };

/** The load as checked on "What we saw": the scan plus the customer's own changes. */
export type Checked = {
  scan: LoadScan;
  vehicle: VehicleId | null;
  care: NoteTag[];
  helpers: number;
};

const EXAMPLES = [
  {
    label: 'Darija',
    text: 'من المعاريف لحي الرياض فالرباط، غدا فالصباح، ب 600 درهم',
  },
  {
    label: 'Français',
    text: 'De Maarif à Hay Riad à Rabat, demain matin, 600 dirhams.',
  },
  {
    label: 'English',
    text: 'From Derb Omar to Ain Sebaa, today at 4 pm, around 250 dirhams',
  },
];
const CARE_TAGS: NoteTag[] = ['fragile', 'heavy', 'upright', 'strap'];

// ---------------- Taking the photo or video ----------------

/** Opens the camera (photo or video, no length limit) or the gallery; returns the new media, or an error key. */
export async function capture(source: 'camera' | 'library', kind: 'photo' | 'video'): Promise<Partial<Media> | Key | null> {
  try {
    if (source === 'camera') {
      const p = await ImagePicker.requestCameraPermissionsAsync();
      if (!p.granted) return 'cameraNoPermission';
    }
    const opts: ImagePicker.ImagePickerOptions =
      source === 'library'
        ? {
            mediaTypes: ['images', 'videos'],
            quality: 0.8,
            videoMaxDuration: 0,
          }
        : kind === 'video'
          ? {
              mediaTypes: ['videos'],
              videoMaxDuration: 0,
              videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
            }
          : { mediaTypes: ['images'], quality: 0.8 };
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return null;
    if (asset.type === 'video') {
      // A still from the video lets the AI see the load too.
      const still = await stillFromVideo(asset.uri);
      return {
        videoUri: asset.uri,
        photoUri: still?.uri ?? '',
        photoBase64: still?.base64 ?? null,
      };
    }
    const small = await manipulateAsync(asset.uri, [{ resize: { width: 1024 } }], { compress: 0.7, format: SaveFormat.JPEG, base64: true });
    return {
      photoUri: small.uri,
      photoBase64: small.base64 ?? null,
      videoUri: '',
    };
  } catch {
    return kind === 'video' ? 'videoFailed' : 'photoFailed';
  }
}

// ---------------- Shared pieces ----------------

/** The three steps as a progress bar: show it, say it, send. */
export function StepsBar({ at }: { at: 0 | 1 | 2 }) {
  const c = useColors();
  const { t } = useT();
  const labels: Key[] = ['st_show', 'st_say', 'st_send'];
  return (
    <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`${at + 1} / 3 · ${t(labels[at])}`}>
      {labels.map((k, i) => (
        <View key={k} style={{ flex: 1, gap: 8 }}>
          <View
            style={{
              height: 4,
              borderRadius: 2,
              backgroundColor: i <= at ? c.accent : c.line,
            }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                borderWidth: 1.5,
                borderColor: i <= at ? c.accent : c.muted,
                backgroundColor: i <= at ? c.accent : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              {i < at ? (
                <Ionicons name="checkmark" size={11} color={c.onAccent} />
              ) : (
                <T size={10} weight="bold" color={i <= at ? c.onAccent : c.muted}>
                  {String(i + 1)}
                </T>
              )}
            </View>
            <T size={13} weight="bold" color={i === at ? c.fg : c.muted}>
              {t(k)}
            </T>
          </View>
        </View>
      ))}
    </View>
  );
}

function Corners({ size = 30, inset = 20, color = '#FFFFFF' }: { size?: number; inset?: number; color?: string }) {
  return (
    <>
      {(['tl', 'tr', 'bl', 'br'] as const).map((k) => (
        <View
          key={k}
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderColor: color,
            ...(k[0] === 't' ? { top: inset, borderTopWidth: 3 } : { bottom: inset, borderBottomWidth: 3 }),
            ...(k[1] === 'l' ? { left: inset, borderLeftWidth: 3 } : { right: inset, borderRightWidth: 3 }),
            ...(k === 'tl' ? { borderTopLeftRadius: 14 } : k === 'tr' ? { borderTopRightRadius: 14 } : k === 'bl' ? { borderBottomLeftRadius: 14 } : { borderBottomRightRadius: 14 }),
          }}
        />
      ))}
    </>
  );
}

// ---------------- 1 · Show it: the first screen ----------------

export function ShowStep({ onMedia, error, onSkip, trips, onTrips }: { onMedia: (source: 'camera' | 'library', kind: 'photo' | 'video') => void; error: Key | ''; onSkip: () => void; trips: number; onTrips: () => void }) {
  const c = useColors();
  const { t, lang } = useT();
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  return (
    <View style={{ flex: 1, gap: 18 }}>
      <T
        size={34}
        weight="heavy"
        style={{
          letterSpacing: lang === 'ar' ? 0 : -1.1,
          lineHeight: lang === 'ar' ? 56 : 38,
          marginTop: 6,
        }}>
        {t('homeTitle')}
      </T>
      <StepsBar at={0} />
      <View
        style={{
          flex: 1,
          minHeight: 330,
          borderRadius: 32,
          backgroundColor: '#17181E',
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#13141A',
          shadowOpacity: 0.35,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 14 },
          elevation: 8,
        }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={mode === 'photo' ? t('takePhoto') : t('recordVideo')}
          onPress={() => onMedia('camera', mode)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            paddingTop: '22%',
          }}>
          <LoadDrawing scale={0.8} />
          <T size={13} color="rgba(255,255,255,0.62)" style={{ marginTop: 22, textAlign: 'center' }}>
            {t('pointAtLoad')}
          </T>
        </Pressable>
        <Corners />
        <View
          style={{
            position: 'absolute',
            bottom: 30,
            alignItems: 'center',
            gap: 16,
          }}
          pointerEvents="box-none">
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 999,
              padding: 4,
              gap: 2,
            }}>
            {(
              [
                ['photo', 'camera', t('photoShort')],
                ['video', 'videocam', t('recordVideo')],
              ] as const
            ).map(([m, icon, label]) => (
              <Pressable
                key={m}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === m }}
                onPress={() => {
                  tap();
                  setMode(m);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 18,
                  minHeight: 38,
                  borderRadius: 999,
                  backgroundColor: mode === m ? '#FFFFFF' : 'transparent',
                }}>
                <Ionicons name={icon} size={16} color={mode === m ? '#13141A' : 'rgba(255,255,255,0.75)'} />
                <T size={14} weight="bold" color={mode === m ? '#13141A' : 'rgba(255,255,255,0.75)'}>
                  {label}
                </T>
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={mode === 'photo' ? t('takePhoto') : t('recordVideo')}
            onPress={() => onMedia('camera', mode)}
            style={({ pressed }) => ({
              width: 78,
              height: 78,
              borderRadius: 39,
              borderWidth: 4,
              borderColor: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale: pressed ? 0.94 : 1 }],
            })}>
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: c.accent,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              {mode === 'photo' ? (
                <Ionicons name="camera" size={26} color="#FFFFFF" />
              ) : (
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: '#FFFFFF',
                  }}
                />
              )}
            </View>
          </Pressable>
        </View>
      </View>
      {error ? (
        <T color={c.danger} style={{ textAlign: 'center' }}>
          {t(error)}
        </T>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => onMedia('library', 'photo')}
        style={{
          flexDirection: 'row',
          alignSelf: 'center',
          alignItems: 'center',
          gap: 8,
          minHeight: 40,
        }}>
        <Ionicons name="images-outline" size={18} color={c.accent} />
        <T size={15} weight="bold" color={c.accent}>
          {t('chooseGallery')}
        </T>
      </Pressable>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 18,
          marginTop: -8,
        }}>
        <Pressable accessibilityRole="button" onPress={onSkip} style={{ minHeight: 36, justifyContent: 'center' }}>
          <T size={13} muted weight="semibold">
            {t('noPhotoSkip')}
          </T>
        </Pressable>
        {trips ? (
          <Pressable
            accessibilityRole="button"
            onPress={onTrips}
            style={{
              minHeight: 36,
              justifyContent: 'center',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}>
            <Ionicons name="time-outline" size={14} color={c.muted} />
            <T size={13} muted weight="semibold">
              {`${t('myTripsShort')} (${trips})`}
            </T>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ---------------- Looking at the load ----------------

/** The photo with a scanning light while the AI looks; what it finds pops in one by one. */
export function ScanStep({ media, run, onDone }: { media: Media; run: () => Promise<LoadScan>; onDone: (scan: LoadScan | null, note: Key | '') => void }) {
  const c = useColors();
  const { t } = useT();
  const sweep = useRef(new Animated.Value(0)).current;
  const [found, setFound] = useState<ScanItem[]>([]);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 1600,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    let dead = false;
    run()
      .then((scan) => {
        if (dead) return;
        // Show what was found one by one, then move on.
        scan.items.forEach((item, i) =>
          setTimeout(
            () => {
              if (dead) return;
              setFound((f) => [...f, item]);
              play('tick');
            },
            260 * (i + 1),
          ),
        );
        setTimeout(() => !dead && done.current(scan, ''), 260 * (scan.items.length + 1) + 700);
      })
      .catch((e: { code?: string }) => !dead && done.current(null, e?.code === 'no_key' ? 'scanNoAi' : 'scanFailed'));
    return () => {
      dead = true;
      loop.stop();
    };
    // Runs once for this photo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={{ flex: 1, gap: 18 }}>
      <StepsBar at={0} />
      <View
        style={{
          height: 360,
          borderRadius: 32,
          overflow: 'hidden',
          backgroundColor: '#17181E',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {media.photoUri ? (
          <Image
            source={{ uri: media.photoUri }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            resizeMode="cover"
          />
        ) : (
          <LoadDrawing scale={0.8} />
        )}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(19,20,26,0.25)',
          }}
        />
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 3,
            backgroundColor: c.accent,
            shadowColor: c.accent,
            shadowOpacity: 0.9,
            shadowRadius: 12,
            elevation: 6,
            transform: [
              {
                translateY: sweep.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 357],
                }),
              },
            ],
          }}
        />
        <Corners />
      </View>
      <View style={{ alignItems: 'center', gap: 14 }}>
        <T size={20} weight="heavy">
          {t('scanning')}
        </T>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 8,
          }}>
          {found.map((item) => (
            <View
              key={item.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: c.surface,
                borderWidth: 1,
                borderColor: c.line,
                borderRadius: 999,
                paddingHorizontal: 12,
                minHeight: 36,
              }}>
              <Ionicons name="checkmark-circle" size={16} color={c.ok} />
              <T size={14} weight="bold">
                {item.count > 1 ? `${item.name} ×${item.count}` : item.name}
              </T>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ---------------- What we saw: everything is one tap from being fixed ----------------

export function SawStep({
  media,
  checked,
  setChecked,
  answers,
  setAnswers,
  note,
  onMorePhoto,
  onRetake,
  onNext,
}: {
  media: Media;
  checked: Checked;
  setChecked: (c: Checked) => void;
  answers: Answers;
  setAnswers: (a: Answers) => void;
  note: Key | '';
  onMorePhoto: () => void;
  onRetake: () => void;
  onNext: () => void;
}) {
  const c = useColors();
  const { t, lang } = useT();
  const [adding, setAdding] = useState(false);
  const [picker, setPicker] = useState(false);
  const { scan } = checked;
  const kg = totalKg(scan.items);
  const range = kgRange(kg);
  const vehicle = checked.vehicle ?? suggestedVehicle(checked);
  const setItems = (items: ScanItem[]) => setChecked({ ...checked, scan: { ...scan, items } });
  const change = (id: string, patch: Partial<ScanItem>) => setItems(scan.items.map((i) => (i.id === id ? { ...i, ...patch, sure: true } : i)));
  const summary = [scan.summary, kg ? `≈ ${fmtKg(roundKg(kg), lang)}` : '', kg ? vName(t, vehicle) : ''].filter(Boolean).join(' · ');

  return (
    <View style={{ gap: 16 }}>
      <StepsBar at={0} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View
          style={{
            width: 76,
            height: 76,
            borderRadius: 20,
            overflow: 'hidden',
            backgroundColor: '#17181E',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {media.photoUri ? <Image source={{ uri: media.photoUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : media.videoUri ? <Ionicons name="videocam" size={26} color="#FFFFFF" /> : <LoadDrawing scale={0.25} />}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T size={24} weight="heavy">
            {t('sawTitle')}
          </T>
          {summary ? (
            <T size={15} weight="bold" color={c.accent}>
              {summary}
            </T>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={onRetake}
            style={{
              minHeight: 28,
              justifyContent: 'center',
              alignSelf: 'flex-start',
            }}>
            <T size={13} muted weight="semibold">
              {t('retakeShort')}
            </T>
          </Pressable>
        </View>
      </View>
      {media.videoUri ? (
        <VideoClip
          uri={media.videoUri}
          style={{
            width: '100%',
            aspectRatio: 16 / 9,
            borderRadius: 20,
            overflow: 'hidden',
          }}
        />
      ) : null}
      {note ? (
        <View style={{ backgroundColor: c.warnSoft, borderRadius: 14, padding: 12 }}>
          <T size={14} color={c.warn}>
            {t(note)}
          </T>
        </View>
      ) : null}

      {/* The items, each with its count. */}
      <Card style={{ gap: 4, paddingVertical: 8 }}>
        {scan.items.length ? null : (
          <T muted style={{ paddingVertical: 8 }}>
            {t('sawEmpty')}
          </T>
        )}
        {scan.items.map((item, i) => (
          <View
            key={item.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              minHeight: 52,
              borderTopWidth: i ? 1 : 0,
              borderTopColor: c.line,
              opacity: item.sure ? 1 : 0.7,
            }}>
            <View style={{ flex: 1 }}>
              <T size={16} weight="bold">
                {item.name}
              </T>
              {!item.sure ? (
                <T size={12} color={c.warn} weight="semibold">
                  {`? ${t('notSure')}`}
                </T>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.name} −1`}
              onPress={() => (item.count > 1 ? change(item.id, { count: item.count - 1 }) : setItems(scan.items.filter((x) => x.id !== item.id)))}
              style={roundBtn(c.raised)}>
              <Ionicons name={item.count > 1 ? 'remove' : 'trash-outline'} size={18} color={c.fg} />
            </Pressable>
            <T size={17} weight="heavy" style={{ minWidth: 30, textAlign: 'center' }}>
              {String(item.count)}
            </T>
            <Pressable accessibilityRole="button" accessibilityLabel={`${item.name} +1`} onPress={() => change(item.id, { count: item.count + 1 })} style={roundBtn(c.raised)}>
              <Ionicons name="add" size={18} color={c.fg} />
            </Pressable>
          </View>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={() => setAdding(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            minHeight: 48,
            borderTopWidth: scan.items.length ? 1 : 0,
            borderTopColor: c.line,
          }}>
          <Ionicons name="add-circle" size={22} color={c.accent} />
          <T size={15} weight="bold" color={c.accent}>
            {t('addItem')}
          </T>
        </Pressable>
      </Card>

      {/* Weight and vehicle. */}
      {kg ? (
        <Card>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
            <T size={14} muted weight="semibold">
              {t('weightTitle')}
            </T>
            <T size={18} weight="heavy">
              {t('weightAbout', {
                low: fmtKg(range.low, lang),
                high: fmtKg(range.high, lang),
              })}
            </T>
          </View>
          <VehicleRow id={vehicle} onChange={() => setPicker(true)} note={vehicleById(vehicle).maxKg >= range.high ? `✓ ${t('fitsOneTrip')}` : undefined} />
        </Card>
      ) : null}

      {/* Care tags the AI switched on; any can be switched off. */}
      <View style={{ gap: 8 }}>
        <T size={14} muted weight="semibold">
          {t('careTitle')}
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CARE_TAGS.map((tag) => (
            <Chip
              key={tag}
              label={t(`n_${tag}` as Key)}
              on={checked.care.includes(tag)}
              ai={scan.care.includes(tag)}
              onPress={() =>
                setChecked({
                  ...checked,
                  care: checked.care.includes(tag) ? checked.care.filter((x) => x !== tag) : [...checked.care, tag],
                })
              }
            />
          ))}
          {[1, 2].map((n) => (
            <Chip
              key={`h${n}`}
              icon="people-outline"
              label={t('helpersTag', { n })}
              on={checked.helpers === n}
              ai={scan.helpers === n}
              onPress={() =>
                setChecked({
                  ...checked,
                  helpers: checked.helpers === n ? 0 : n,
                })
              }
            />
          ))}
        </View>
      </View>

      {/* At most three questions the photo can't answer. */}
      <Card>
        <Question label={t('q_floor')}>
          {(['ground', '1', '2', '3', '4+'] as const).map((f) => (
            <Chip
              key={f}
              label={f === 'ground' ? t('floorGround') : f}
              on={answers.floor === f}
              onPress={() =>
                setAnswers({
                  ...answers,
                  floor: answers.floor === f ? '' : f,
                  lift: f === 'ground' ? '' : answers.lift,
                })
              }
            />
          ))}
        </Question>
        {answers.floor && answers.floor !== 'ground' ? (
          <Question label={t('q_lift')}>
            {(['yes', 'no'] as const).map((v) => (
              <Chip key={v} label={t(v)} on={answers.lift === v} onPress={() => setAnswers({ ...answers, lift: answers.lift === v ? '' : v })} />
            ))}
          </Question>
        ) : null}
        <Question label={t('q_all')}>
          <Chip
            label={t('allYes')}
            on={answers.all === 'yes'}
            onPress={() =>
              setAnswers({
                ...answers,
                all: answers.all === 'yes' ? '' : 'yes',
              })
            }
          />
          <Chip label={t('allMore')} icon="camera-outline" on={false} onPress={onMorePhoto} />
        </Question>
      </Card>

      <Btn title={t('looksRight')} icon="arrow-forward" disabled={!scan.items.length} onPress={onNext} />

      <AddItem visible={adding} onClose={() => setAdding(false)} onAdd={(item) => setItems(mergeItem(scan.items, item))} />
      <VehiclePicker
        visible={picker}
        value={vehicle}
        weightKg={nearestWeight(kg)}
        onPick={(id) => {
          setChecked({ ...checked, vehicle: id });
          setPicker(false);
        }}
        onClose={() => setPicker(false)}
      />
    </View>
  );
}

/** Rounds an estimate so it reads as one (≈ 300 kg, not 298 kg). */
const roundKg = (kg: number) => (kg >= 1000 ? Math.round(kg / 100) * 100 : Math.round(kg / 50) * 50 || 50);

const roundBtn = (bg: string) => ({
  width: 38,
  height: 38,
  borderRadius: 19,
  backgroundColor: bg,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
});

function Question({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <T size={15} weight="heavy">
        {label}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
    </View>
  );
}

/** Adds one, or one more of something already on the list. */
function mergeItem(items: ScanItem[], item: ScanItem) {
  const same = items.find((i) => i.name.toLowerCase() === item.name.toLowerCase());
  return same ? items.map((i) => (i === same ? { ...i, count: i.count + 1, sure: true } : i)) : [...items, item];
}

/** The scan's vehicle while it can carry the list; a bigger one once the list outgrows it. */
export function suggestedVehicle(checked: Checked): VehicleId {
  const high = kgRange(totalKg(checked.scan.items)).high;
  return vehicleById(checked.scan.vehicle).maxKg >= high ? checked.scan.vehicle : bestFit(high);
}

function AddItem({ visible, onClose, onAdd }: { visible: boolean; onClose: () => void; onAdd: (item: ScanItem) => void }) {
  const c = useColors();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const add = (name: string, kgEach: number) => {
    onAdd({ id: itemId(), name, count: 1, kgEach, sure: true });
    play('pop');
    setText('');
    onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={onClose} />
      <View
        style={{
          backgroundColor: c.bg,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          padding: 20,
          paddingBottom: insets.bottom + 20,
          gap: 14,
        }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
          <T size={20} weight="heavy">
            {t('addItemTitle')}
          </T>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('close')}
            onPress={onClose}
            style={{
              width: 44,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="close" size={24} color={c.fg} />
          </Pressable>
        </View>
        <ScrollView
          style={{ maxHeight: 260 }}
          contentContainerStyle={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
          }}>
          {COMMON_ITEMS.map((it) => (
            <Chip key={it.id} icon={it.icon as keyof typeof Ionicons.glyphMap} label={t(`it_${it.id}` as Key)} on={false} onPress={() => add(t(`it_${it.id}` as Key), it.kg)} />
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('itemPlaceholder')}
            placeholderTextColor={c.muted}
            accessibilityLabel={t('itemPlaceholder')}
            style={{
              flex: 1,
              minHeight: 50,
              borderRadius: 14,
              backgroundColor: c.raised,
              paddingHorizontal: 14,
              fontSize: 16,
              color: c.fg,
            }}
          />
          <Btn title={t('add')} small disabled={!text.trim()} onPress={() => add(text.trim(), 20)} />
        </View>
      </View>
    </Modal>
  );
}

// ---------------- 2 · Say it ----------------

export function SayStep({ media, setMedia, busy, error, onNext, onSkip }: { media: Media; setMedia: (m: Media) => void; busy: boolean; error: Key | ''; onNext: () => void; onSkip: () => void }) {
  const c = useColors();
  const { t, lang } = useT();
  const [speech, setSpeech] = useState<SpeechLang>(lang === 'fr' ? 'fr-FR' : lang === 'en' ? 'en-US' : 'ar-MA');
  const latest = useRef(media);
  latest.current = media;
  const voiceOnly = useVoiceRecorder((uri, ms) => setMedia({ ...latest.current, voiceUri: uri, voiceMs: ms }));
  return (
    <View style={{ gap: 16 }}>
      <StepsBar at={1} />
      <View style={{ gap: 4 }}>
        <T size={28} weight="heavy">
          {t('sayTitle')}
        </T>
        <T muted>{t('saySub')}</T>
      </View>
      <Card>
        <BigMic speechLang={speech} text={media.said} onText={(s) => setMedia({ ...latest.current, said: s })} onVoiceNote={(uri, ms) => setMedia({ ...latest.current, voiceUri: uri, voiceMs: ms })} />
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
          }}>
          <T size={13} muted weight="semibold">
            {t('speakIn')}
          </T>
          {SPEECH_LANGS.map((l) => (
            <Chip key={l.id} label={l.label} on={speech === l.id} onPress={() => setSpeech(l.id)} />
          ))}
        </View>
        {media.voiceUri ? (
          <View style={{ gap: 6 }}>
            <VoicePlayer uri={media.voiceUri} ms={media.voiceMs} label={t('voiceNoteYours')} />
            <Pressable accessibilityRole="button" onPress={() => setMedia({ ...latest.current, voiceUri: '', voiceMs: 0 })} style={{ minHeight: 34, justifyContent: 'center' }}>
              <T size={13} weight="bold" color={c.danger}>
                {t('deleteVoice')}
              </T>
            </Pressable>
          </View>
        ) : null}
        <T size={13} weight="semibold" muted>
          {t('orType')}
        </T>
        <TextInput
          value={media.said}
          onChangeText={(s) => setMedia({ ...latest.current, said: s })}
          multiline
          placeholder={t('typePlaceholder')}
          placeholderTextColor={c.muted}
          accessibilityLabel={t('orType')}
          style={{
            minHeight: 84,
            borderRadius: 16,
            backgroundColor: c.raised,
            padding: 14,
            fontSize: 16,
            color: c.fg,
            textAlignVertical: 'top',
          }}
        />
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
          }}>
          <T size={13} muted weight="semibold">
            {t('tryExample')}
          </T>
          {EXAMPLES.map((e) => (
            <Chip key={e.label} label={e.label} on={media.said === e.text} onPress={() => setMedia({ ...latest.current, said: e.text })} />
          ))}
        </View>
        {!media.voiceUri ? (
          voiceOnly.recording ? (
            <Btn title={t('micStop')} kind="ghost" small icon="stop" onPress={() => voiceOnly.stop(true)} />
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => voiceOnly.start()}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                minHeight: 36,
              }}>
              <Ionicons name="mic-outline" size={16} color={c.accent} />
              <T size={13} weight="bold" color={c.accent}>
                {t('voiceOnly')}
              </T>
            </Pressable>
          )
        ) : null}
      </Card>
      {error ? <T color={c.danger}>{t(error)}</T> : null}
      <Btn title={busy ? t('reading') : t('sayNext')} icon="sparkles" busy={busy} disabled={!media.said.trim() && !media.voiceUri} onPress={onNext} />
      <Pressable accessibilityRole="button" onPress={onSkip} style={{ alignSelf: 'center', minHeight: 40, justifyContent: 'center' }}>
        <T size={14} muted weight="semibold">
          {t('sayLater')}
        </T>
      </Pressable>
    </View>
  );
}

// ---------------- From the checked load to the request card ----------------

/** The card's starting point from "What we saw" and the answers (route, time and price come from "Say it"). */
export function draftFromChecked(checked: Checked, answers: Answers, t: ReturnType<typeof useT>['t']): Draft {
  const kg = totalKg(checked.scan.items);
  const tags: NoteTag[] = [...checked.care];
  if (answers.floor === 'ground') tags.push('ground');
  else if (answers.floor) tags.push('upstairs');
  if (answers.lift === 'yes') tags.push('lift');
  if (answers.lift === 'no') tags.push('noLift');
  return {
    goods: checked.scan.goods[0] ?? '',
    load: checked.scan.items.map((i) => (i.count > 1 ? `${i.name} ×${i.count}` : i.name)).join(', '),
    weightKg: nearestWeight(kg),
    vehicle: checked.vehicle ?? suggestedVehicle(checked),
    from: '',
    to: '',
    when: 'now',
    price: 300,
    fairMin: 0,
    fairMax: 0,
    km: 0,
    noteTags: tags,
    notes: answers.floor && answers.floor !== 'ground' ? t('floorN', { n: answers.floor }) : '',
    helpers: checked.helpers,
    rideAlong: false,
  };
}

/** Runs the AI on the photo (or a further photo, adding to the list). */
export const runScan = (apiKey: string, media: Media, lang: Parameters<typeof scanLoad>[2], current?: LoadScan) => scanLoad(apiKey, media.photoBase64, lang, current);
