import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { CallButton } from './call';
import { capture } from './flow';
import { useT, type Key } from './i18n';
import { type Person } from './people';
import {
  acceptOffer,
  answerHelpersClaim,
  answerTimeChange,
  askTimeChange,
  canClaimHelpers,
  claimHelpersMissing,
  CUST_TAGS,
  customerCancelLevel,
  keepLooking,
  keepWaiting,
  letOthersOffer,
  noAnswerState,
  rateCustomer,
  reportNoAnswer,
  reportNoShow,
  sendAgain,
  waitMinutes,
} from './rules';
import { dh } from './shared';
import { getState, patchRequest, update, useStore, type Request } from './store';
import { Sheet } from './trip';
import { Btn, T, tap, useColors } from './ui';
import { formatWhen, WhenPicker } from './wheels';
import { play } from './sounds';
import { repeatRequest } from './home';

/**
 * The owner's rules on screen (rules.ts holds the logic). Warm words, firm rules: nothing here
 * threatens anyone, and nothing promises what the test version can't do yet.
 */

function Box({ tone = 'raised', icon, title, sub, children }: { tone?: 'raised' | 'warn' | 'live' | 'ok'; icon: keyof typeof Ionicons.glyphMap; title: string; sub?: string; children?: React.ReactNode }) {
  const c = useColors();
  const bg = tone === 'warn' ? c.warnSoft : tone === 'live' ? c.liveSoft : tone === 'ok' ? c.okSoft : c.raised;
  const fg = tone === 'warn' ? c.warn : tone === 'live' ? c.live : tone === 'ok' ? c.ok : c.accent;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 16, padding: 12, gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Ionicons name={icon} size={18} color={fg} />
        <View style={{ flex: 1, gap: 2 }}>
          <T size={14} weight="heavy">
            {title}
          </T>
          {sub ? (
            <T size={13} muted>
              {sub}
            </T>
          ) : null}
        </View>
      </View>
      {children}
    </View>
  );
}

const Row = ({ children }: { children: React.ReactNode }) => <View style={{ flexDirection: 'row', gap: 8 }}>{children}</View>;
const Half = ({ children }: { children: React.ReactNode }) => <View style={{ flex: 1 }}>{children}</View>;

/** The customer as the driver sees them (for the call nudges). */
function useCustomerPerson(): Person {
  const { t } = useT();
  const me = useStore().customer;
  return { role: 'customer', name: me.name || t('customer'), photo: me.photoUri, city: me.city || undefined };
}

// ---------- Rule 1: the driver calls the customer ----------

/** Right after he takes the trip, and on the way: call the customer (a normal thing to do). */
export function CallNudge({ req }: { req: Request }) {
  const { t } = useT();
  const person = useCustomerPerson();
  if (req.stage !== 'accepted' && req.stage !== 'enroute') return null;
  if (req.stage === 'accepted' && !req.takenAt) return null;
  return (
    <Box tone="live" icon="call-outline" title={req.stage === 'enroute' ? t('cn_onWay', { name: person.name }) : t('cn_confirm', { name: person.name })}>
      <CallButton person={person} label={t('callCustomer')} />
    </Box>
  );
}

/** At the pickup: nobody answers → the app reaches the customer; the driver can take the team photo. */
export function AtPickupDriver({ req }: { req: Request }) {
  const c = useColors();
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  if (req.stage !== 'arrived') return null;
  const team = async () => {
    if (busy) return;
    setBusy(true);
    const got = await capture('camera', 1);
    setBusy(false);
    if (!got || typeof got === 'string' || !got[0]) return;
    patchRequest(req.id, { teamPhoto: got[0].uri, tripPhotos: [...(req.tripPhotos ?? []), { uri: got[0].uri, by: 'driver', at: Date.now(), stage: 'arrived' }] });
    play('pop');
  };
  return (
    <View style={{ gap: 8 }}>
      {/* Rule 11: one photo with his team protects him when helpers were promised. */}
      {req.helpers > 0 ? (
        req.teamPhoto ? (
          <T size={13} weight="bold" color={c.ok}>
            {`✓ ${t('tp_done')}`}
          </T>
        ) : (
          <Box tone="warn" icon="people-outline" title={t('tp_title', { n: req.helpers })} sub={t('tp_sub')}>
            <Btn title={busy ? t('photoTaking') : t('tp_btn')} icon="camera" small onPress={team} />
          </Box>
        )
      ) : null}
      {/* Rule 1: nobody answers at the pickup. */}
      {req.noShowAt ? (
        <T size={13} muted>
          {t('ns_sentDrv')}
        </T>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            tap();
            reportNoShow(req.id);
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: c.line }}>
          <Ionicons name="notifications-outline" size={16} color={c.accent} />
          <T size={13} weight="bold">
            {t('ns_btn')}
          </T>
        </Pressable>
      )}
    </View>
  );
}

// ---------- Rule 11: the helpers claim ----------

/** The driver answers the customer's «the helpers didn't come». */
export function HelpersClaimDriver({ req }: { req: Request }) {
  const { t } = useT();
  if (!req.helpersClaim || req.helpersClaim.driver) return null;
  return (
    <Box tone="warn" icon="people-outline" title={t('hc_askMsg', { n: req.helpers })}>
      <Row>
        <Half>
          <Btn title={t('hc_drvYes')} small kind="ghost" onPress={() => answerHelpersClaim(req.id, 'yes')} />
        </Half>
        <Half>
          <Btn title={t('hc_drvNo')} small onPress={() => answerHelpersClaim(req.id, 'no')} />
        </Half>
      </Row>
    </Box>
  );
}

/**
 * The customer at the pickup: «did he come with N helpers?» (only between «Arrived» and «Loaded»).
 * No → the driver is asked; then a new price or a cancel that counts against nobody, or the price stays.
 */
export function HelpersCustomer({ req, onCancelFree }: { req: Request; onCancelFree: () => void }) {
  const { t } = useT();
  if (!req.helpers) return null;
  if (req.helpersClaim?.driver === 'yes')
    return req.stage === 'arrived' ? (
      <Box tone="warn" icon="people-outline" title={t('hc_yesMsg', { name: req.driverName ?? '' })}>
        <Btn title={t('helpersCancelFree')} small kind="ghost" onPress={onCancelFree} />
      </Box>
    ) : null;
  if (req.helpersClaim?.driver === 'no') return req.stage === 'arrived' ? <Box icon="information-circle-outline" title={t('hc_noMsg', { name: req.driverName ?? '' })} /> : null;
  if (req.helpersClaim) return <Box icon="hourglass-outline" title={t('hc_waiting', { name: req.driverName ?? '' })} />;
  if (!canClaimHelpers(req) || req.helpersCame) return null;
  return (
    <Box icon="people-outline" title={req.helpers === 1 ? t('helpersCameQ1', { name: req.driverName ?? '' }) : t('helpersCameQ', { name: req.driverName ?? '', n: req.helpers })}>
      <Row>
        <Half>
          <Btn
            title={t('helpersCameYes')}
            icon="checkmark"
            small
            onPress={() => {
              patchRequest(req.id, { helpersCame: 'yes' });
              play('pop');
            }}
          />
        </Half>
        <Half>
          <Btn title={t('helpersCameNo')} kind="ghost" small onPress={() => claimHelpersMissing(req.id)} />
        </Half>
      </Row>
    </Box>
  );
}

// ---------- Rule 2: moving the trip instead of cancelling ----------

/** A new time the customer asked for: the driver answers; the customer sees it waiting. */
export function TimeAskCard({ req, role }: { req: Request; role: 'customer' | 'driver' }) {
  const { t, lang } = useT();
  if (!req.timeAsk) return null;
  const when = formatWhen(req.timeAsk.when, lang, t);
  if (role === 'customer') return <Box icon="time-outline" title={t('tc_waiting', { when, name: req.driverName ?? '' })} />;
  return (
    <Box tone="warn" icon="time-outline" title={t('tc_askNt', { when })}>
      <Row>
        <Half>
          <Btn title={t('tc_keep')} small kind="ghost" onPress={() => answerTimeChange(req.id, false)} />
        </Half>
        <Half>
          <Btn title={t('tc_accept')} small onPress={() => answerTimeChange(req.id, true)} />
        </Half>
      </Row>
    </Box>
  );
}

/**
 * Rule 2: once the driver is on his way, the customer has «I have a problem»: call him first,
 * change the time, and only then cancel. Once he arrived or the goods are on board: no cancel in
 * the app, only Xapp's team (and the helpers case of Rule 11).
 */
export function ProblemSheet({ req, visible, onClose, onCancel, onHelp }: { req: Request; visible: boolean; onClose: () => void; onCancel: () => void; onHelp: () => void }) {
  const { t } = useT();
  const level = customerCancelLevel(req);
  const [picking, setPicking] = useState(false);
  const [when, setWhen] = useState(req.when);
  useEffect(() => {
    if (visible) {
      setPicking(false);
      setWhen(req.when);
    }
  }, [visible, req.when]);
  const driver: Person = { role: 'driver', name: req.driverName ?? '', vehicle: req.driverVehicle, example: req.driverIsExample };
  return (
    <Sheet visible={visible} onClose={onClose} title={t('pb_title')}>
      {level === 'team' ? (
        <>
          <T size={14} muted>
            {t('pb_teamOnly')}
          </T>
          <CallButton person={driver} label={t('pb_callDriver', { name: driver.name })} />
          <Btn
            title={t('pb_contactTeam')}
            icon="help-buoy"
            kind="ghost"
            onPress={() => {
              onClose();
              onHelp();
            }}
          />
        </>
      ) : (
        <>
          <T size={14} muted>
            {t('pb_coming', { name: driver.name })}
          </T>
          <CallButton person={driver} label={t('pb_callDriver', { name: driver.name })} />
          {picking ? (
            <View style={{ gap: 10 }}>
              <WhenPicker value={when} onChange={setWhen} />
              <Btn
                title={t('pb_sendTime')}
                disabled={when === 'now' || when === req.when}
                onPress={() => {
                  askTimeChange(req.id, when);
                  onClose();
                }}
              />
            </View>
          ) : (
            <Btn title={t('pb_changeTime')} icon="time-outline" kind="ghost" disabled={!!req.timeAsk} onPress={() => setPicking(true)} />
          )}
          <Btn
            title={t('pb_stillCancel')}
            kind="danger"
            small
            onPress={() => {
              onClose();
              onCancel();
            }}
          />
        </>
      )}
    </Sheet>
  );
}

// ---------- Rule 7b: the driver doesn't answer ----------

/** On a booked trip (before the driver sets off): «The driver doesn't answer», then wait, then choose. */
export function NoAnswerCard({ req }: { req: Request }) {
  const { t } = useT();
  const [, tick] = useState(0);
  useEffect(() => {
    if (!req.noAnswerAt) return;
    const id = setInterval(() => tick((n) => n + 1), 15000);
    return () => clearInterval(id);
  }, [req.noAnswerAt]);
  if (req.stage !== 'accepted' || !req.driverName) return null;
  const state = noAnswerState(req);
  if (req.reopenedAt) return <ReopenedOffers req={req} />;
  if (state === 'waiting') return <Box icon="hourglass-outline" title={t('na_waiting', { name: req.driverName, min: waitMinutes(req, req.noAnswerAt) })} />;
  if (state === 'choose')
    return (
      <Box tone="warn" icon="alert-circle-outline" title={t('na_chooseTitle', { name: req.driverName })} sub={t('na_chooseSub')}>
        <Row>
          <Half>
            <Btn title={t('na_keepWaiting')} small kind="ghost" onPress={() => keepWaiting(req.id)} />
          </Half>
          <Half>
            <Btn title={t('na_letOthers')} small onPress={() => letOthersOffer(req.id)} />
          </Half>
        </Row>
      </Box>
    );
  return null;
}

/** The small link that starts it (in the trip page and the chat). */
export function NoAnswerLink({ req }: { req: Request }) {
  const c = useColors();
  const { t } = useT();
  if (req.stage !== 'accepted' || !req.takenAt || req.noAnswerAt || req.reopenedAt) return null;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tap();
        reportNoAnswer(req.id);
      }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: c.line }}>
      <Ionicons name="call-outline" size={15} color={c.muted} />
      <T size={13} weight="bold" muted>
        {t('na_link')}
      </T>
    </Pressable>
  );
}

/** Offers from other drivers while the first one keeps the trip. */
function ReopenedOffers({ req }: { req: Request }) {
  const c = useColors();
  const { t, lang } = useT();
  const store = useStore();
  const offers = store.offers.filter((o) => o.requestId === req.id && o.driverName !== req.driverName && o.status !== 'declined');
  return (
    <Box tone="live" icon="radio-outline" title={t('na_reopenMsg', { name: req.driverName ?? '' })}>
      {offers.length ? (
        offers.map((o) => (
          <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.surface, borderRadius: 14, padding: 10 }}>
            <View style={{ flex: 1 }}>
              <T weight="heavy">{o.driverName}</T>
              <T size={13} muted>
                {dh(o.price, lang)}
              </T>
            </View>
            <Btn
              title={t('accept')}
              small
              onPress={() => {
                acceptOffer(req.id, o.id);
                play('success');
              }}
            />
          </View>
        ))
      ) : (
        <T size={13} muted>
          {t('na_noOffersYet')}
        </T>
      )}
    </Box>
  );
}

// ---------- Rule 4: no driver yet ----------

/** On the offers page once the app asked «no driver yet»: keep looking, raise the price, or stop. */
export function ExpiryCard({ req, onRaise, onStop }: { req: Request; onRaise: () => void; onStop: () => void }) {
  const { t } = useT();
  if (req.stage !== 'open' || !req.expiryAskAt) return null;
  // Another day: once answered it stays open until the time (Rule 4); the card only shows the first time.
  if (req.when !== 'now' && req.openSince && req.openSince >= req.expiryAskAt) return null;
  const answer = () => {
    keepLooking(req.id);
    if (req.when !== 'now') patchRequest(req.id, { openSince: Date.now() });
  };
  return (
    <Box tone="warn" icon="time-outline" title={t('ex_askNt')} sub={req.when === 'now' ? t('ex_nowSub') : t('ex_laterSub')}>
      <Row>
        <Half>
          <Btn title={t('ex_keep')} small kind="ghost" onPress={answer} />
        </Half>
        <Half>
          <Btn
            title={t('raisePrice')}
            small
            onPress={() => {
              answer();
              onRaise();
            }}
          />
        </Half>
      </Row>
      <Btn title={t('ex_stop')} small kind="danger" onPress={onStop} />
    </Box>
  );
}

/** A request that closed by itself: shown the next time the app opens, with «Send again» and «Edit». */
export function ClosedRequests({ onOpen }: { onOpen?: () => void }) {
  const { t, lang, route } = useT();
  const store = useStore();
  const closed = store.requests.filter((r) => r.closedQuietly && !r.closedSeen);
  if (!closed.length) return null;
  return (
    <View style={{ gap: 8 }}>
      {closed.slice(0, 2).map((r) => (
        <Box key={r.id} icon="moon-outline" title={t('ex_closedTitle')} sub={`${route(r.from.split(/[,،]/)[0], r.to.split(/[,،]/)[0])} · ${dh(r.price, lang)}`}>
          <Row>
            <Half>
              <Btn
                title={t('ex_edit')}
                small
                kind="ghost"
                onPress={() => {
                  patchRequest(r.id, { closedSeen: true });
                  // The request page opens with the same answers, ready to change (as «Repeat this request»).
                  onOpen?.();
                  setTimeout(() => repeatRequest(r.id), 0);
                }}
              />
            </Half>
            <Half>
              <Btn
                title={t('ex_again')}
                small
                icon="refresh"
                onPress={() => {
                  patchRequest(r.id, { closedSeen: true });
                  sendAgain(r);
                  play('send');
                  onOpen?.();
                }}
              />
            </Half>
          </Row>
          <Pressable accessibilityRole="button" onPress={() => patchRequest(r.id, { closedSeen: true })} style={{ alignSelf: 'center', minHeight: 36, justifyContent: 'center' }}>
            <T size={13} weight="bold" muted>
              {t('ex_dismiss')}
            </T>
          </Pressable>
        </Box>
      ))}
    </View>
  );
}

// ---------- Rule 3: the driver rates the customer ----------

/** The job page leaves once the trip is handed over, so the rating sheet lives at the top of the driver side. */
let rateListener: ((id: string) => void) | null = null;
export const openRateCustomer = (id: string) => rateListener?.(id);
export function RateCustomerHost() {
  const store = useStore();
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    rateListener = setId;
    return () => {
      rateListener = null;
    };
  }, []);
  const req = id ? (store.requests.find((r) => r.id === id) ?? null) : null;
  return <RateCustomerSheet req={req} visible={!!req} onClose={() => setId(null)} />;
}

export function RateCustomerSheet({ req, visible, onClose }: { req: Request | null; visible: boolean; onClose: () => void }) {
  const c = useColors();
  const { t } = useT();
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  useEffect(() => {
    if (visible) {
      setStars(0);
      setTags([]);
    }
  }, [visible]);
  if (!req) return null;
  return (
    <Sheet visible={visible} onClose={onClose} title={t('rc_title')}>
      <T size={13} muted>
        {t('rc_sub')}
      </T>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} accessibilityRole="button" accessibilityLabel={String(n)} onPress={() => { tap(); setStars(n); }} hitSlop={4}>
            <Ionicons name={n <= stars ? 'star' : 'star-outline'} size={36} color={n <= stars ? c.warn : c.muted} />
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {CUST_TAGS.map((k) => {
          const on = tags.includes(k);
          return (
            <Pressable key={k} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => { tap(); setTags(on ? tags.filter((x) => x !== k) : [...tags, k]); }} style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center', borderWidth: on ? 2 : 1, borderColor: on ? c.accent : c.line, backgroundColor: c.surface }}>
              <T size={14} weight={on ? 'bold' : 'regular'}>
                {t(k as Key)}
              </T>
            </Pressable>
          );
        })}
      </View>
      <Btn
        title={t('rc_send')}
        disabled={!stars}
        onPress={() => {
          rateCustomer(req.id, stars, tags);
          play('pop');
          onClose();
        }}
      />
      <Btn title={t('rc_skip')} kind="ghost" small onPress={onClose} />
    </Sheet>
  );
}

// ---------- Rule 2: the customer's record, said gently ----------

/** After a 2nd late cancel in 30 days a kind word; during a pause, sending waits (the team calls). */
export function useCustomerPause() {
  const rec = useStore().custRecord;
  const now = Date.now();
  return rec?.pausedUntil && rec.pausedUntil > now ? rec.pausedUntil : 0;
}

export const _unused = { getState, update };
