import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { PhotoTile } from '@/components/driver/photo-tile';
import { STEP_LABELS } from '@/components/driver/verification';
import { ProgressSteps } from '@/components/progress-steps';
import { Text } from '@/components/text';
import { Button, Card, ForwardChevron, IconButton, Screen } from '@/components/ui';
import { pickPhoto } from '@/lib/pick-photo';
import { DOC_IDS, useDriver, verificationSteps, type DocId } from '@/state/driver';
import { Radius, Spacing, useColors } from '@/theme';

const DOC_LABELS: Record<DocId, string> = {
  cinFront: 'driver.docCinFront',
  cinBack: 'driver.docCinBack',
  licence: 'driver.docLicence',
  carteGrise: 'driver.docCarteGrise',
  insurance: 'driver.docInsurance',
};

const SECTIONS: { title: string; docs: DocId[] }[] = [
  { title: 'driver.stepIdentity', docs: ['cinFront', 'cinBack'] },
  { title: 'driver.stepLicence', docs: ['licence'] },
  { title: 'driver.stepPapers', docs: ['carteGrise', 'insurance'] },
];

export default function DriverDocuments() {
  const { t } = useTranslation();
  const colors = useColors();
  const { profile, setDocument, update } = useDriver();
  const steps = verificationSteps(profile);
  const remaining = DOC_IDS.filter((id) => !profile.documents[id]).length;
  const allDone = steps.every((step) => step.done);

  return (
    <Screen
      footer={
        allDone ? (
          <Button
            title={t('driver.ctaSubmit')}
            variant="accent"
            icon="paper-plane-outline"
            onPress={() => {
              update({ status: 'pending' });
              router.back();
            }}
          />
        ) : (
          <Button title={t('driver.saveLater')} variant="ghost" onPress={() => router.back()} />
        )
      }>
      <View style={styles.header}>
        <IconButton label={t('common.back')} icon={<ForwardChevron color={colors.text} flip />} onPress={() => router.back()} />
        <Text variant="title" style={{ flex: 1 }}>
          {t('driver.documentsTitle')}
        </Text>
        {remaining > 0 && (
          <View style={[styles.remaining, { backgroundColor: colors.accentSoft }]}>
            <Text variant="caption" color={colors.accent}>
              {t('driver.docsRemaining', { count: remaining })}
            </Text>
          </View>
        )}
      </View>

      <ProgressSteps
        labels={steps.map((step) => t(STEP_LABELS[step.id]))}
        completed={steps.filter((step) => step.done).length}
      />
      <Text muted>{t('driver.documentsBody')}</Text>

      {SECTIONS.map((section) => (
        <Card key={section.title}>
          <Text variant="subtitle">{t(section.title)}</Text>
          <View style={styles.docs}>
            {section.docs.map((id) => (
              <View key={id} style={styles.doc}>
                <Text variant="caption" muted>
                  {t(DOC_LABELS[id])}
                </Text>
                <PhotoTile
                  uri={profile.documents[id]}
                  label={t(DOC_LABELS[id])}
                  onPick={async () => {
                    const uri = await pickPhoto();
                    if (uri) setDocument(id, uri);
                  }}
                />
              </View>
            ))}
          </View>
        </Card>
      ))}

      <View style={styles.note}>
        <MaterialCommunityIcons name="flask-outline" size={16} color={colors.textMuted} />
        <Text variant="caption" muted style={{ flex: 1 }}>
          {t('driver.testPhotosNote')}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  remaining: { paddingHorizontal: Spacing.md, paddingVertical: 2, borderRadius: Radius.pill },
  docs: { flexDirection: 'row', gap: Spacing.md },
  doc: { flex: 1, gap: Spacing.xs },
  note: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
});
