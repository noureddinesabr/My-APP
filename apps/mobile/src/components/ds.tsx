/**
 * Design system v2 building blocks shared by the customer, driver and admin interfaces.
 * One component per pattern: status badges, prototype labels, screen states (loading, empty,
 * error, offline, success), confirmation dialogs, form fields with validation, list rows,
 * info rows, price breakdowns, toggles and filter chips. Screens compose these instead of
 * styling look-alikes by hand.
 */
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { formatMoney } from '@/components/money';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Text } from '@/components/text';
import { TextInput } from '@/components/text-input';
import { Button, ForwardChevron } from '@/components/ui';
import { play } from '@/lib/sounds';
import { Fonts, Radius, rim, Spacing, useColors } from '@/theme';

type MciName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/* ------------------------------------------------------------------ status */

/**
 * One status vocabulary across the customer, driver and admin interfaces (Doc 5 D2). Each
 * status has one colour family and one icon everywhere.
 */
export type StatusKind =
  | 'pending'
  | 'accepted'
  | 'confirmed'
  | 'inTransit'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'disputed'
  | 'overdue'
  | 'paid'
  | 'draft'
  | 'published'
  | 'verified'
  | 'suspended'
  | 'live';

const STATUS: Record<StatusKind, { icon: MciName; tone: 'neutral' | 'blue' | 'teal' | 'green' | 'gold' | 'red' }> = {
  pending: { icon: 'clock-outline', tone: 'gold' },
  accepted: { icon: 'check', tone: 'blue' },
  confirmed: { icon: 'check-decagram', tone: 'blue' },
  inTransit: { icon: 'truck-fast-outline', tone: 'teal' },
  delivered: { icon: 'package-variant-closed-check', tone: 'teal' },
  completed: { icon: 'check-circle', tone: 'green' },
  cancelled: { icon: 'close-circle-outline', tone: 'neutral' },
  disputed: { icon: 'alert-octagon-outline', tone: 'red' },
  overdue: { icon: 'alert-circle', tone: 'red' },
  paid: { icon: 'cash-check', tone: 'green' },
  draft: { icon: 'pencil-outline', tone: 'neutral' },
  published: { icon: 'broadcast', tone: 'teal' },
  verified: { icon: 'shield-check', tone: 'green' },
  suspended: { icon: 'cancel', tone: 'red' },
  live: { icon: 'access-point', tone: 'teal' },
};

export function useTone() {
  const colors = useColors();
  return (tone: 'neutral' | 'blue' | 'teal' | 'green' | 'gold' | 'red') =>
    ({
      neutral: { fg: colors.textMuted, bg: colors.surfaceMuted },
      blue: { fg: colors.primary, bg: colors.primarySoft },
      teal: { fg: colors.teal, bg: colors.tealSoft },
      green: { fg: colors.success, bg: colors.successSoft },
      gold: { fg: colors.star, bg: colors.surfaceMuted },
      red: { fg: colors.accent, bg: colors.accentSoft },
    })[tone];
}

/** A small pill with the status icon and its word, in the status's colour. */
export function StatusBadge({ status, label }: { status: StatusKind; label?: string }) {
  const { t } = useTranslation();
  const tone = useTone()(STATUS[status].tone);
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]} accessibilityLabel={label ?? t(`ds.status_${status}`)}>
      <MaterialCommunityIcons name={STATUS[status].icon} size={14} color={tone.fg} />
      <Text variant="caption" color={tone.fg} style={styles.badgeText}>
        {label ?? t(`ds.status_${status}`)}
      </Text>
    </View>
  );
}

/** A neutral tag (Shared, Return trip, Dedicated, Verified…) with an optional icon. */
export function Tag({ icon, label, tone = 'blue' }: { icon?: MciName; label: string; tone?: 'neutral' | 'blue' | 'teal' | 'green' | 'gold' | 'red' }) {
  const c = useTone()(tone);
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      {icon && <MaterialCommunityIcons name={icon} size={14} color={c.fg} />}
      <Text variant="caption" color={c.fg} style={styles.badgeText}>
        {label}
      </Text>
    </View>
  );
}

/* --------------------------------------------------------------- prototype */

/**
 * Marks anything that runs on mock data or local prototype state, so nobody mistakes it for
 * a real transaction (Phase 2 rule). `inline` is a small tag; the default is a banner.
 */
export function PrototypeNote({ text, inline }: { text?: string; inline?: boolean }) {
  const { t } = useTranslation();
  const colors = useColors();
  if (inline) return <Tag icon="flask-outline" tone="gold" label={t('ds.prototype')} />;
  return (
    <View style={[styles.proto, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
      <MaterialCommunityIcons name="flask-outline" size={18} color={colors.star} />
      <Text variant="caption" style={{ flex: 1 }}>
        <Text variant="caption" style={{ fontFamily: Fonts.bold }}>
          {t('ds.prototype')}
        </Text>
        {' · '}
        {text ?? t('ds.prototypeBody')}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ states */

export type ScreenState = 'loading' | 'empty' | 'error' | 'offline' | 'success';

const STATE_ICON: Record<Exclude<ScreenState, 'loading'>, MciName> = {
  empty: 'inbox-outline',
  error: 'alert-circle-outline',
  offline: 'wifi-off',
  success: 'check-circle-outline',
};

/**
 * Loading, empty, error, offline and success states with the same shape everywhere: an icon,
 * one line of what happened, an optional next step. Never an empty white screen (Doc 5 D3).
 */
export function StateView({
  state,
  title,
  body,
  action,
  onAction,
  compact,
}: {
  state: ScreenState;
  title?: string;
  body?: string;
  action?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const tone = state === 'error' ? colors.accent : state === 'success' ? colors.success : state === 'offline' ? colors.star : colors.primary;
  return (
    <View style={[styles.state, compact && styles.stateCompact]} accessibilityRole={state === 'error' ? 'alert' : undefined}>
      {state === 'loading' ? (
        <ActivityIndicator color={colors.primary} size="large" />
      ) : (
        <View style={[styles.stateIcon, { backgroundColor: colors.surfaceMuted }]}>
          <MaterialCommunityIcons name={STATE_ICON[state]} size={30} color={tone} />
        </View>
      )}
      <Text variant="label" center>
        {title ?? t(`ds.state_${state}`)}
      </Text>
      {!!body && (
        <Text variant="caption" muted center>
          {body}
        </Text>
      )}
      {action && onAction && <Button compact variant={state === 'error' || state === 'offline' ? 'outline' : 'primary'} title={action} icon={state === 'error' || state === 'offline' ? 'refresh' : undefined} onPress={onAction} />}
    </View>
  );
}

/* ---------------------------------------------------------------- dialogs */

/**
 * The one confirmation dialog: a title, what will happen, an optional reason field (required
 * for admin overrides, Doc 3 §6), and Cancel / Confirm. Destructive actions use `danger`.
 */
export function ConfirmDialog({
  visible,
  title,
  body,
  confirm,
  cancel,
  danger,
  reason,
  onReason,
  reasonLabel,
  onConfirm,
  onCancel,
  children,
}: {
  visible: boolean;
  title: string;
  body?: string;
  confirm: string;
  cancel?: string;
  danger?: boolean;
  /** When given, a reason must be typed before Confirm is enabled. */
  reason?: string;
  onReason?: (text: string) => void;
  reasonLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const needsReason = reason !== undefined;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={[styles.scrim, { backgroundColor: colors.scrim }]} onPress={onCancel} accessibilityLabel={cancel ?? t('common.back')}>
        <Pressable style={[styles.dialog, { backgroundColor: colors.surfaceRaised }, rim(colors)]} onPress={() => {}}>
          <Text variant="subtitle">{title}</Text>
          {!!body && <Text muted>{body}</Text>}
          {children}
          {needsReason && <FormField label={reasonLabel ?? t('ds.reason')} value={reason} onChangeText={onReason ?? (() => {})} required multiline error={null} />}
          <View style={styles.dialogActions}>
            <View style={{ flex: 1 }}>
              <Button compact variant="ghost" title={cancel ?? t('common.back')} onPress={onCancel} />
            </View>
            <View style={{ flex: 1 }}>
              <Button compact variant={danger ? 'danger' : 'accent'} title={confirm} disabled={needsReason && !reason?.trim()} onPress={onConfirm} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ------------------------------------------------------------------ forms */

/** A labelled field with a required mark, a hint and a validation message under it. */
export function FormField({
  label,
  value,
  onChangeText,
  error,
  hint,
  required,
  multiline,
  keyboardType,
  placeholder,
  suffix,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  /** null = valid, a string = the message to show. */
  error?: string | null;
  hint?: string;
  required?: boolean;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad' | 'phone-pad' | 'email-address';
  placeholder?: string;
  suffix?: string;
}) {
  const colors = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text variant="caption" style={{ fontFamily: Fonts.semibold }}>
        {label}
        {required ? <Text variant="caption" color={colors.accent}> *</Text> : null}
      </Text>
      <View style={styles.fieldRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          multiline={multiline}
          keyboardType={keyboardType}
          placeholder={placeholder}
          accessibilityLabel={label}
          style={[{ flex: 1 }, multiline && styles.multiline, !!error && { borderColor: colors.accent }]}
        />
        {suffix && (
          <Text variant="label" muted>
            {suffix}
          </Text>
        )}
      </View>
      {error ? (
        <View style={styles.errorRow} accessibilityRole="alert">
          <Ionicons name="alert-circle" size={15} color={colors.accent} />
          <Text variant="caption" color={colors.accent} style={{ flex: 1 }}>
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text variant="caption" muted>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** A labelled on/off switch row. */
export function ToggleRow({ label, hint, value, onChange, icon }: { label: string; hint?: string; value: boolean; onChange: (value: boolean) => void; icon?: MciName }) {
  const colors = useColors();
  return (
    <PressableScale
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      scaleTo={0.98}
      feedback={null}
      onPress={() => {
        play('tap');
        onChange(!value);
      }}
      style={[styles.toggle, { backgroundColor: colors.surface, borderColor: value ? colors.primary : colors.border }]}>
      {icon && <MaterialCommunityIcons name={icon} size={22} color={colors.primary} />}
      <View style={{ flex: 1 }}>
        <Text variant="label">{label}</Text>
        {!!hint && (
          <Text variant="caption" muted>
            {hint}
          </Text>
        )}
      </View>
      <View style={[styles.switch, { backgroundColor: value ? colors.primaryFill : colors.control }]}>
        <View style={[styles.knob, { backgroundColor: colors.surface }, value ? styles.knobOn : null]} />
      </View>
    </PressableScale>
  );
}

/** Pick one of a few options shown as cards with a title and an explanation (radio cards). */
export function OptionCards<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; title: string; body?: string; icon?: MciName }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  const colors = useColors();
  return (
    <View style={{ gap: Spacing.sm }} accessibilityRole="radiogroup">
      {options.map((option) => {
        const on = option.value === value;
        return (
          <PressableScale
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            scaleTo={0.98}
            feedback={null}
            onPress={() => {
              play('tap');
              onChange(option.value);
            }}
            style={[styles.option, { backgroundColor: on ? colors.primarySoft : colors.surface, borderColor: on ? colors.primary : colors.border }]}>
            {option.icon && <MaterialCommunityIcons name={option.icon} size={24} color={colors.primary} />}
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label">{option.title}</Text>
              {!!option.body && (
                <Text variant="caption" muted>
                  {option.body}
                </Text>
              )}
            </View>
            <MaterialCommunityIcons name={on ? 'radiobox-marked' : 'radiobox-blank'} size={24} color={on ? colors.primary : colors.textMuted} />
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Filter / tab chips in a row; the chosen one is filled. Works as tabs over a list. */
export function FilterChips<T extends string>({ options, value, onChange }: { options: { value: T; label: string; count?: number }[]; value: T; onChange: (value: T) => void }) {
  const colors = useColors();
  return (
    <View style={styles.chips} accessibilityRole="tablist">
      {options.map((option) => {
        const on = option.value === value;
        return (
          <PressableScale
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            scaleTo={0.95}
            feedback={null}
            onPress={() => {
              play('tap');
              onChange(option.value);
            }}
            style={[styles.chip, { backgroundColor: on ? colors.cta : colors.surface, borderColor: on ? colors.cta : colors.border }]}>
            <Text variant="caption" color={on ? colors.onCta : colors.text} style={{ fontFamily: Fonts.semibold }}>
              {option.label}
              {option.count !== undefined ? ` · ${option.count}` : ''}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------- list parts */

/** A section title with an optional "see all" action. */
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text variant="subtitle" style={{ flex: 1 }}>
        {title}
      </Text>
      {action && onAction && (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text variant="caption" color={colors.primary} style={{ fontFamily: Fonts.semibold }}>
            {action}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/** A tappable row: icon, title, subtitle, a right-hand value or badge, and a chevron. */
export function ListRow({
  icon,
  title,
  subtitle,
  value,
  right,
  onPress,
  tone,
}: {
  icon?: MciName;
  title: string;
  subtitle?: string;
  value?: string;
  right?: ReactNode;
  onPress?: () => void;
  tone?: string;
}) {
  const colors = useColors();
  const body = (
    <>
      {icon && (
        <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}>
          <MaterialCommunityIcons name={icon} size={20} color={tone ?? colors.primary} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label">{title}</Text>
        {!!subtitle && (
          <Text variant="caption" muted>
            {subtitle}
          </Text>
        )}
      </View>
      {!!value && <Text variant="label">{value}</Text>}
      {right}
      {onPress && <ForwardChevron color={colors.textMuted} />}
    </>
  );
  const style = [styles.row, { backgroundColor: colors.surface }, rim(colors)];
  return onPress ? (
    <PressableScale accessibilityRole="button" scaleTo={0.98} onPress={onPress} style={style}>
      {body}
    </PressableScale>
  ) : (
    <View style={style}>{body}</View>
  );
}

/** A label / value line inside a card (booking details, invoice header…). */
export function InfoRow({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <View style={styles.info}>
      <Text variant={strong ? 'label' : 'body'} muted={!strong} style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant={strong ? 'subtitle' : 'label'} color={tone}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Price breakdown used by booking confirmation, shared-booking adjustments and invoices:
 * lines, then the total. Money is always shown in the same format.
 */
export function PriceBreakdown({ lines, total, totalLabel, note }: { lines: { label: string; amount: number; negative?: boolean }[]; total: number; totalLabel: string; note?: string }) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <View style={[styles.breakdown, { backgroundColor: colors.surface }, rim(colors)]}>
      {lines.map((line) => (
        <InfoRow key={line.label} label={line.label} value={`${line.negative ? '− ' : ''}${formatMoney(t, line.amount)}`} tone={line.negative ? colors.success : undefined} />
      ))}
      <View style={[styles.rule, { backgroundColor: colors.border }]} />
      <InfoRow label={totalLabel} value={formatMoney(t, total)} strong />
      {!!note && (
        <Text variant="caption" muted>
          {note}
        </Text>
      )}
    </View>
  );
}

/** A big number with its label (KPIs, earnings, balances). */
export function Stat({ label, value, tone, style }: { label: string; value: string; tone?: string; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface }, rim(colors), style]}>
      <Text variant="caption" muted>
        {label}
      </Text>
      <Text variant="title" color={tone ?? colors.text} style={styles.statValue}>
        {value}
      </Text>
    </View>
  );
}

/* ----------------------------------------------------------------- headers */

/** The header of a stack screen: back, title (and subtitle), an optional action on the end side. */
export function PageHeader({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack?: () => void; right?: ReactNode }) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <View style={styles.header}>
      {onBack && (
        <PressableScale accessibilityRole="button" accessibilityLabel={t('common.back')} scaleTo={0.9} onPress={onBack} style={[styles.back, { backgroundColor: colors.surface }, rim(colors)]}>
          <ForwardChevron color={colors.text} flip />
        </PressableScale>
      )}
      <View style={{ flex: 1 }}>
        <Text variant="title" style={styles.headerTitle}>
          {title}
        </Text>
        {!!subtitle && (
          <Text variant="caption" muted>
            {subtitle}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
}

/** A field that opens a picker (city, date, vehicle): label above, current value inside. */
export function SelectField({ label, value, placeholder, icon, onPress, error }: { label: string; value?: string; placeholder?: string; icon?: MciName; onPress: () => void; error?: string | null }) {
  const colors = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text variant="caption" style={{ fontFamily: Fonts.semibold }}>
        {label}
      </Text>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={label}
        scaleTo={0.98}
        onPress={onPress}
        style={[styles.select, { backgroundColor: colors.surfaceMuted, borderColor: error ? colors.accent : colors.border }]}>
        {icon && <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />}
        <Text variant="body" color={value ? colors.text : colors.textMuted} style={{ flex: 1 }}>
          {value ?? placeholder}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={22} color={colors.textMuted} />
      </PressableScale>
      {!!error && (
        <Text variant="caption" color={colors.accent}>
          {error}
        </Text>
      )}
    </View>
  );
}

/** "Step 2 of 4" with a thin bar, for progressive multi-step forms. */
export function StepIndicator({ step, total, label }: { step: number; total: number; label: string }) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text variant="caption" muted>
        {t('ds.step', { step, total })} · {label}
      </Text>
      <View style={[styles.stepTrack, { backgroundColor: colors.surfaceMuted }]}>
        <View style={[styles.stepFill, { width: `${(step / total) * 100}%`, backgroundColor: colors.primaryFill }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headerTitle: { fontSize: 22, lineHeight: 30 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  select: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 54, paddingHorizontal: Spacing.md, borderRadius: Radius.md, borderWidth: 2 },
  stepTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  stepFill: { height: 6, borderRadius: 3 },
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.pill },
  badgeText: { fontSize: 13, lineHeight: 19, fontFamily: Fonts.semibold },
  proto: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderStyle: 'dashed' },
  state: { alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.lg },
  stateCompact: { paddingVertical: Spacing.lg },
  stateIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  dialog: { width: '100%', maxWidth: 440, borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.md },
  dialogActions: { flexDirection: 'row', gap: Spacing.sm },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1.5 },
  switch: { width: 46, height: 28, borderRadius: 14, padding: 3, direction: 'ltr' },
  knob: { width: 22, height: 22, borderRadius: 11 },
  knobOn: { marginLeft: 18 },
  option: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: 7, borderRadius: Radius.pill, borderWidth: 1 },
  section: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg },
  rowIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  info: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  breakdown: { borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  stat: { flexGrow: 1, flexBasis: 140, borderRadius: Radius.lg, padding: Spacing.md, gap: 2 },
  statValue: { fontSize: 22, lineHeight: 30 },
});
