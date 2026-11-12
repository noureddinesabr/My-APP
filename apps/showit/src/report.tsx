import { Ionicons } from '@expo/vector-icons';
import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { captureScreen } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCallOpen } from './call';
import { autoDir } from './composer';
import { useT } from './i18n';
import { Overlay } from './overlay';
import { play } from './sounds';
import { getState, update, useStore, type Report } from './store';
import { Btn, T, tap, useColors, useKeyboardInset } from './ui';
import { whereNow } from './where';

/**
 * Test version: reporting a problem from any screen. A small tab on the screen's edge takes a
 * picture of the screen as it is, then opens a box to say what's wrong (typed, or spoken and
 * written down). Reports stay on the phone; Settings › My reports sends them all as one PDF
 * (screen picture, words, page, language) to share with the team.
 */
const reportDir = () => {
  const dir = new Directory(Paths.document, 'reports');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
};
const newId = () => `r${Date.now().toString(36)}`;

export function ReportTab() {
  const c = useColors();
  const { t } = useT();
  const store = useStore();
  const { height } = useWindowDimensions();
  const callOpen = useCallOpen();
  const [hidden, setHidden] = useState(false);
  const [draft, setDraft] = useState<{ shot?: string; where: string } | null>(null);
  if (store.reportTab === false || callOpen) return draft ? <ReportSheet draft={draft} onClose={() => setDraft(null)} /> : null;
  const open = async () => {
    tap();
    const where = whereNow();
    let shot: string | undefined;
    if (Platform.OS !== 'web') {
      // The tab steps aside for a moment so it isn't in the picture.
      setHidden(true);
      await new Promise((r) => setTimeout(r, 120));
      try {
        shot = await captureScreen({ format: 'jpg', quality: 0.7, result: 'tmpfile' });
      } catch {
        shot = undefined;
      }
      setHidden(false);
    }
    setDraft({ shot, where });
  };
  return (
    <>
      {hidden || draft ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('rpTitle')}
          onPress={open}
          hitSlop={6}
          style={({ pressed }) => ({ position: 'absolute', end: 0, top: Math.round(height * 0.58), width: 44, paddingVertical: 10, alignItems: 'center', gap: 2, borderTopStartRadius: 14, borderBottomStartRadius: 14, backgroundColor: c.ink, opacity: pressed ? 1 : 0.82, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 6 })}>
          <Ionicons name="flag" size={16} color={c.onInk} />
          <T size={9} weight="bold" color={c.onInk} numberOfLines={1} adjustsFontSizeToFit style={{ lineHeight: 12, letterSpacing: -0.2 }}>
            {t('rpTab')}
          </T>
        </Pressable>
      )}
      {draft ? <ReportSheet draft={draft} onClose={() => setDraft(null)} /> : null}
    </>
  );
}

const SPEECH: Record<string, string> = { ar: 'ar-MA', fr: 'fr-FR', en: 'en-US' };
/** The language last chosen for speaking (kept while the app is open). */
let lastSpeechLang: string | null = null;

function ReportSheet({ draft, onClose }: { draft: { shot?: string; where: string }; onClose: () => void }) {
  const c = useColors();
  const { t, lang } = useT();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardInset();
  const { height } = useWindowDimensions();
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [saved, setSaved] = useState(0);
  // Dictation that lets you take your time (owner's request): every finished sentence is kept,
  // pauses never erase anything, and when Android's recognizer stops by itself after a silence it
  // starts again quietly until you press Stop. The language you speak can differ from the app's.
  const [speechLang, setSpeechLang] = useState<string>(lastSpeechLang ?? lang);
  const want = useRef(false);
  const base = useRef('');
  const finals = useRef<string[]>([]);
  const interim = useRef('');
  const [since, setSince] = useState(0);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!listening) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [listening]);
  const show = () => setText([base.current, ...finals.current, interim.current].map((x) => x.trim()).filter(Boolean).join(' '));
  const begin = () => {
    try {
      ExpoSpeechRecognitionModule.start({
        lang: SPEECH[speechLang] ?? 'en-US',
        interimResults: true,
        continuous: true,
        addsPunctuation: true,
        // Wait through long pauses before Android decides you're done.
        androidIntentOptions: { EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 15000, EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 15000, EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 30000 },
      });
    } catch {
      want.current = false;
      setListening(false);
    }
  };
  useSpeechRecognitionEvent('result', (e) => {
    if (!want.current) return;
    const said = e.results[0]?.transcript ?? '';
    if (e.isFinal) {
      if (said.trim()) finals.current.push(said.trim());
      interim.current = '';
    } else interim.current = said;
    show();
  });
  useSpeechRecognitionEvent('end', () => {
    // A pause ended the recognizer: keep what was heard and listen again, until Stop is pressed.
    if (interim.current.trim()) {
      finals.current.push(interim.current.trim());
      interim.current = '';
      show();
    }
    if (want.current) setTimeout(() => want.current && begin(), 250);
    else setListening(false);
  });
  useSpeechRecognitionEvent('error', (e) => {
    // Silence or "nothing heard" is normal while thinking: the 'end' event restarts listening.
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'language-not-supported') {
      want.current = false;
      setListening(false);
    }
  });
  const stopListening = () => {
    want.current = false;
    if (interim.current.trim()) {
      finals.current.push(interim.current.trim());
      interim.current = '';
      show();
    }
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {}
    setListening(false);
  };
  const speak = async () => {
    tap();
    if (listening) {
      stopListening();
      return;
    }
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) return;
      base.current = text.trim();
      finals.current = [];
      interim.current = '';
      want.current = true;
      setSince(Date.now());
      setListening(true);
      begin();
    } catch {
      want.current = false;
      setListening(false);
    }
  };
  useEffect(
    () => () => {
      want.current = false;
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {}
    },
    [],
  );
  const secs = listening ? Math.max(0, Math.floor((Date.now() - since) / 1000)) : 0;
  const save = async () => {
    if (listening) stopListening();
    const id = newId();
    let shot: string | undefined;
    if (draft.shot) {
      try {
        const kept = new File(reportDir(), `${id}.jpg`);
        await new File(draft.shot).copy(kept);
        shot = kept.uri;
      } catch {
        shot = draft.shot;
      }
    }
    const s = getState();
    const report: Report = { id, at: Date.now(), shot, text: text.trim(), where: draft.where, lang: s.lang, role: s.role, look: s.appearance ?? 'light' };
    update((st) => ({ ...st, reports: [...(st.reports ?? []), report] }));
    play('success');
    setSaved((s.reports ?? []).length + 1);
    setTimeout(onClose, 1300);
  };
  const shotH = Math.round(Math.min(height * 0.3, 260));
  return (
    <Overlay visible onClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={onClose} />
      <View style={{ backgroundColor: c.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 16, paddingBottom: keyboard ? keyboard + 12 : insets.bottom + 20, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name="flag" size={20} color={c.accent} />
          <T size={20} weight="heavy" style={{ flex: 1 }}>
            {t('rpTitle')}
          </T>
          <Pressable accessibilityRole="button" accessibilityLabel={t('close')} onPress={onClose} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={24} color={c.fg} />
          </Pressable>
        </View>
        {saved ? (
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: 24 }}>
            <Ionicons name="checkmark-circle" size={48} color={c.ok} />
            <T size={16} weight="bold" style={{ textAlign: 'center' }}>
              {t('rpSaved', { n: saved })}
            </T>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              {draft.shot ? (
                <Image source={{ uri: draft.shot }} style={{ width: Math.round(shotH * 0.48), height: shotH, borderRadius: 12, borderWidth: 1, borderColor: c.line }} resizeMode="cover" accessibilityLabel={t('rpTitle')} />
              ) : (
                <View style={{ flex: 1, backgroundColor: c.raised, borderRadius: 12, padding: 10 }}>
                  <T size={12} muted>
                    {t('rpNoShot')}
                  </T>
                </View>
              )}
              {draft.shot ? (
                <T size={13} muted style={{ flex: 1 }}>
                  {t('rpShotNote')}
                </T>
              ) : null}
            </View>
            <TextInput
              value={text}
              onChangeText={(v) => {
                setText(v);
                // Typing while listening: what's in the box now is kept, new words go after it.
                base.current = v;
                finals.current = [];
                interim.current = '';
              }}
              multiline
              autoFocus={Platform.OS === 'web'}
              placeholder={t('rpHint')}
              placeholderTextColor={c.muted}
              accessibilityLabel={t('rpHint')}
              style={[{ minHeight: 96, maxHeight: 180, borderRadius: 16, borderWidth: 2, borderColor: c.accent, backgroundColor: c.surface, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: c.fg, textAlignVertical: 'top' }, autoDir(text, lang), { outlineWidth: 0, outlineStyle: 'none' } as object]}
            />
            {/* Which language you will speak (it can differ from the app's). */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <T size={12} muted>
                {t('rpSpeakIn')}
              </T>
              {(['ar', 'fr', 'en'] as const).map((l) => (
                <Pressable
                  key={l}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: speechLang === l }}
                  disabled={listening}
                  onPress={() => {
                    tap();
                    lastSpeechLang = l;
                    setSpeechLang(l);
                  }}
                  style={{ minHeight: 34, paddingHorizontal: 12, borderRadius: 999, justifyContent: 'center', borderWidth: 1, borderColor: speechLang === l ? c.accent : c.line, backgroundColor: speechLang === l ? c.accent : c.surface, opacity: listening && speechLang !== l ? 0.5 : 1 }}>
                  <T size={13} weight="bold" color={speechLang === l ? c.onAccent : c.fg}>
                    {l === 'ar' ? 'العربية' : l === 'fr' ? 'Français' : 'English'}
                  </T>
                </Pressable>
              ))}
            </View>
            {listening ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.raised, borderRadius: 12, padding: 10 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.danger }} />
                <T size={13} style={{ flex: 1 }}>
                  {t('rpTakeTime')}
                </T>
                <T size={13} weight="bold" style={{ writingDirection: 'ltr' }}>
                  {`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}
                </T>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={listening ? t('rpListening') : t('rpSpeak')}
                onPress={speak}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, paddingHorizontal: 14, borderRadius: 14, backgroundColor: listening ? c.danger : c.raised, opacity: pressed ? 0.85 : 1 })}>
                <Ionicons name={listening ? 'stop' : 'mic'} size={18} color={listening ? '#FFFFFF' : c.fg} />
                <T size={14} weight="bold" color={listening ? '#FFFFFF' : c.fg}>
                  {listening ? t('rpListening') : t('rpSpeak')}
                </T>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Btn title={t('rpSave')} small icon="checkmark" disabled={!text.trim() && !draft.shot} onPress={save} />
              </View>
            </View>
          </>
        )}
      </View>
    </Overlay>
  );
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] ?? ch);

/** All reports as one PDF (pictures inside), shared through the phone's share menu. */
async function shareAll(reports: Report[]) {
  const parts: string[] = [];
  for (const [i, r] of reports.entries()) {
    let img = '';
    if (r.shot) {
      try {
        img = `<img src="data:image/jpeg;base64,${await new File(r.shot).base64()}">`;
      } catch {
        img = '';
      }
    }
    const when = new Date(r.at).toLocaleString();
    parts.push(`<section><h2>#${i + 1}</h2><p class="meta">${esc(when)} · ${esc(r.role)} · ${esc(r.lang)} · ${esc(r.look)} · ${esc(r.where || '-')}</p><p class="text" dir="auto">${esc(r.text || '(no words)')}</p>${img}</section>`);
  }
  const html = `<html><head><meta charset="utf-8"><style>body{font-family:sans-serif;padding:16px}section{page-break-inside:avoid;border-bottom:1px solid #ddd;padding:12px 0}h2{margin:0;font-size:18px}.meta{color:#666;font-size:12px;margin:4px 0}.text{font-size:16px;white-space:pre-wrap}img{max-height:560px;border:1px solid #ccc;border-radius:8px}</style></head><body><h1>Xapp Show it · ${reports.length} report(s)</h1>${parts.join('')}</body></html>`;
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Xapp reports' });
}

/** Settings › Testing: the report tab on/off, and the list of reports to send or delete. */
export function ReportsSection() {
  const c = useColors();
  const { t } = useT();
  const store = useStore();
  const reports = store.reports ?? [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);
  const remove = (r: Report) => {
    tap();
    try {
      if (r.shot) new File(r.shot).delete();
    } catch {}
    update((s) => ({ ...s, reports: (s.reports ?? []).filter((x) => x.id !== r.id) }));
  };
  const on = store.reportTab !== false;
  return (
    <View style={{ gap: 10 }}>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: on }}
        onPress={() => {
          tap();
          update((s) => ({ ...s, reportTab: !on }));
        }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 }}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="flag-outline" size={18} color={c.fg} />
        </View>
        <T weight="bold" style={{ flex: 1 }}>
          {t('rpShowTab')}
        </T>
        <View style={{ width: 52, height: 30, borderRadius: 15, backgroundColor: on ? c.accent : c.line, padding: 3, direction: 'ltr', alignItems: on ? 'flex-end' : 'flex-start' }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF' }} />
        </View>
      </Pressable>
      <T weight="heavy">{t('rpMine', { n: reports.length })}</T>
      {!reports.length ? (
        <T size={13} muted>
          {t('rpNone')}
        </T>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {reports.map((r, i) => (
              <View key={r.id} style={{ width: 132, gap: 6, backgroundColor: c.raised, borderRadius: 14, padding: 8 }}>
                {r.shot ? <Image source={{ uri: r.shot }} style={{ width: 116, height: 150, borderRadius: 10 }} resizeMode="cover" /> : null}
                <T size={12} weight="bold" numberOfLines={3}>
                  {`#${i + 1} · ${r.text || '—'}`}
                </T>
                <Pressable accessibilityRole="button" accessibilityLabel={`${t('rpDelete')} #${i + 1}`} onPress={() => remove(r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 }}>
                  <Ionicons name="trash-outline" size={15} color={c.danger} />
                  <T size={12} color={c.danger}>
                    {t('rpDelete')}
                  </T>
                </Pressable>
              </View>
            ))}
          </ScrollView>
          {Platform.OS === 'web' ? (
            <T size={12} muted>
              {t('rpOnlyPhone')}
            </T>
          ) : (
            <Btn
              title={t('rpShareAll')}
              small
              icon="share-outline"
              busy={busy}
              onPress={async () => {
                setError('');
                setBusy(true);
                try {
                  await shareAll(reports);
                } catch {
                  setError(t('rpPdfFailed'));
                }
                setBusy(false);
              }}
            />
          )}
          <T size={12} muted>
            {t('rpShareHint')}
          </T>
          {error ? (
            <T size={13} color={c.danger}>
              {error}
            </T>
          ) : null}
          {confirmAll ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Btn title={t('rpDeleteAll')} small kind="ink" onPress={() => { reports.forEach(remove); setConfirmAll(false); }} />
              </View>
              <View style={{ flex: 1 }}>
                <Btn title={t('back')} small kind="ghost" onPress={() => setConfirmAll(false)} />
              </View>
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => setConfirmAll(true)} style={{ minHeight: 36, justifyContent: 'center' }}>
              <T size={13} color={c.danger}>
                {t('rpDeleteAll')}
              </T>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}
