import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { StateView } from '@/components/ds';
import { Text } from '@/components/text';
import { TextInput } from '@/components/text-input';
import { Fonts, Radius, rim, Spacing, useColors } from '@/theme';

export type Column<T> = { key: string; label: string; flex?: number; render: (row: T) => ReactNode; numeric?: boolean };

/**
 * The admin table (Doc 5 D4): a header row and one row per record on desktop; stacked label /
 * value cards on narrow screens. Columns follow the reading direction (right to left in
 * Arabic); numbers stay left-to-right inside their cells. Rows open a detail panel.
 */
export function DataTable<T>({ rows, columns, rowKey, onRowPress, empty, selected }: { rows: T[] | undefined; columns: Column<T>[]; rowKey: (row: T) => string; onRowPress?: (row: T) => void; empty: string; selected?: string | null }) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  if (rows === undefined) return <StateView state="loading" compact />;
  if (rows.length === 0) return <StateView state="empty" compact title={empty} />;
  return (
    <View style={[styles.table, { backgroundColor: colors.surface }, rim(colors)]} accessibilityRole="list">
      {wide && (
        <View style={[styles.row, styles.headRow, { backgroundColor: colors.surfaceMuted }]}>
          {columns.map((column) => (
            <Text key={column.key} variant="caption" style={[styles.headCell, { flex: column.flex ?? 1 }]}>
              {column.label}
            </Text>
          ))}
        </View>
      )}
      {rows.map((row) => {
        const key = rowKey(row);
        const on = selected === key;
        return (
          <Pressable
            key={key}
            accessibilityRole={onRowPress ? 'button' : undefined}
            onPress={onRowPress ? () => onRowPress(row) : undefined}
            style={({ hovered }: { hovered?: boolean }) => [
              wide ? styles.row : styles.card,
              { borderTopColor: colors.border, backgroundColor: on ? colors.primarySoft : hovered && onRowPress ? colors.surfaceMuted : 'transparent' },
            ]}>
            {columns.map((column) =>
              wide ? (
                <View key={column.key} style={[styles.cell, { flex: column.flex ?? 1 }]}>
                  {wrap(column.render(row), column.numeric)}
                </View>
              ) : (
                <View key={column.key} style={styles.cardLine}>
                  <Text variant="caption" muted style={styles.cardLabel}>
                    {column.label}
                  </Text>
                  <View style={{ flex: 1 }}>{wrap(column.render(row), column.numeric)}</View>
                </View>
              ),
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function wrap(node: ReactNode, numeric?: boolean) {
  return typeof node === 'string' || typeof node === 'number' ? (
    <Text variant="caption" style={numeric ? styles.numeric : undefined}>
      {node}
    </Text>
  ) : (
    node
  );
}

/** Search box + filter chips above a table. */
export function Toolbar({ search, onSearch, children }: { search?: string; onSearch?: (text: string) => void; children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <View style={styles.toolbar}>
      {onSearch && (
        <View style={{ flexGrow: 1, flexBasis: 240, maxWidth: 420 }}>
          <TextInput value={search} onChangeText={onSearch} placeholder={t('admin2.search')} accessibilityLabel={t('admin2.search')} style={styles.search} />
        </View>
      )}
      {children}
    </View>
  );
}

/** The detail panel: beside the table on desktop, under it on narrow screens. */
export function DetailLayout({ table, detail }: { table: ReactNode; detail: ReactNode | null }) {
  const { width } = useWindowDimensions();
  const wide = width >= 1100;
  return (
    <View style={[styles.split, wide && styles.splitWide]}>
      <View style={{ flex: 1, minWidth: 0, gap: Spacing.md }}>{table}</View>
      {detail && <View style={wide ? styles.side : undefined}>{detail}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  table: { borderRadius: Radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  headRow: { borderTopWidth: 0 },
  headCell: { fontFamily: Fonts.semibold },
  cell: { minWidth: 0 },
  card: { padding: Spacing.md, gap: 4, borderTopWidth: StyleSheet.hairlineWidth },
  cardLine: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  cardLabel: { width: 110 },
  numeric: { writingDirection: 'ltr', fontVariant: ['tabular-nums'] },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm },
  search: { minHeight: 44, paddingVertical: 8 },
  split: { gap: Spacing.md },
  splitWide: { flexDirection: 'row', alignItems: 'flex-start' },
  side: { width: 380 },
});
