import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Radius, Spacing, useColors } from '@/theme';

/** Dashed "add photo" box, or the picked photo with a replace label. */
export function PhotoTile({ uri, label, onPick }: { uri?: string; label?: string; onPick: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? t('driver.addPhoto')}
      onPress={onPick}
      style={[
        styles.photo,
        { borderColor: uri ? colors.success : colors.primary, backgroundColor: uri ? colors.surface : colors.primarySoft },
      ]}>
      {uri ? (
        <>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={[styles.photoBadge, { backgroundColor: colors.successFill }]}>
            <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
            <Text variant="caption" color={colors.onPrimary} style={{ fontSize: 11, lineHeight: 16 }}>
              {t('driver.replacePhoto')}
            </Text>
          </View>
        </>
      ) : (
        <>
          <MaterialCommunityIcons name="camera-plus-outline" size={30} color={colors.primary} />
          <Text variant="caption" color={colors.primary} center>
            {t('driver.addPhoto')}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  photo: {
    height: 140,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    overflow: 'hidden',
  },
  photoBadge: {
    position: 'absolute',
    bottom: Spacing.sm,
    end: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
});
