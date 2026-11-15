import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';

import { postSupportAuto, sendMessage } from '@/backend/actions';
import { useQuery, useStore } from '@/backend';
import { useDateFormat } from '@/components/date-format';
import { Glass } from '@/components/glass';
import { useEventText } from '@/components/live/event-text';
import { Text } from '@/components/text';
import { TextInput } from '@/components/text-input';
import { ForwardChevron, IconButton } from '@/components/ui';
import { useLanguage } from '@/i18n/language-provider';
import { play } from '@/lib/sounds';
import { useAccount } from '@/state/account';
import { useRole } from '@/state/role';
import { Radius, rim, Spacing, useColors } from '@/theme';

/**
 * "Write to us": a conversation with Xapp support, in the person's language. In the test version
 * the team doesn't answer yet; an automatic line says so after the first message.
 */
export default function SupportChat() {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const dates = useDateFormat();
  const eventText = useEventText();
  const { rtl } = useLanguage();
  const { role } = useRole();
  const account = useAccount();
  const me = role === 'driver' ? 'driver' : 'client';
  const person = me === 'driver' ? account.driver : account.client;
  const threadId = `support_${person?.id ?? 'guest'}`;
  const messages = useQuery('messages', [['jobId', threadId]]);
  const sorted = [...(messages ?? [])].sort((a, b) => a.at - b.at);
  const [text, setText] = useState('');
  const scroll = useRef<ScrollViewInstance>(null);

  const send = async () => {
    const value = text.trim();
    if (!value) return;
    setText('');
    play('send');
    await sendMessage(store, threadId, me, { text: value });
    if (!sorted.some((message) => message.auto === 'supportAuto')) await postSupportAuto(store, threadId);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
        <Glass style={styles.header} thickness="thick">
          <IconButton label={t('common.back')} icon={<ForwardChevron color={colors.text} flip />} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <View style={[styles.logo, { backgroundColor: colors.primaryFill }]}>
            <Ionicons name="help-buoy" size={22} color={colors.onPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="label">{t('help.supportTitle')}</Text>
            <Text variant="caption" muted>
              {t('help.supportSub')}
            </Text>
          </View>
        </Glass>
        <ScrollView ref={scroll} contentContainerStyle={styles.list} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
          <View style={[styles.bubble, { backgroundColor: colors.surface, alignSelf: rtl ? 'flex-end' : 'flex-start' }, rim(colors)]}>
            <Text>{t('help.supportHello')}</Text>
          </View>
          {sorted.map((message) =>
            message.from === 'system' ? (
              <View key={message.id} style={[styles.event, { backgroundColor: colors.primarySoft }]}>
                <Text variant="caption" color={colors.primary} center>
                  {eventText(message)}
                </Text>
              </View>
            ) : (
              <View key={message.id} style={[styles.bubble, { backgroundColor: colors.primaryFill, alignSelf: rtl ? 'flex-start' : 'flex-end' }]}>
                <Text color={colors.onPrimary} userText>
                  {message.text}
                </Text>
                <Text variant="caption" color={colors.onPrimary} style={{ fontSize: 12, opacity: 0.75, alignSelf: 'flex-end' }}>
                  {dates.time(new Date(message.at))}
                </Text>
              </View>
            ),
          )}
        </ScrollView>
        <View style={[styles.composer, { backgroundColor: colors.surfaceRaised, borderColor: colors.rim }]}>
          <TextInput value={text} onChangeText={setText} placeholder={t('help.supportHint')} style={{ flex: 1 }} onSubmitEditing={send} returnKeyType="send" multiline />
          <Pressable accessibilityRole="button" accessibilityLabel={t('chat.send')} disabled={!text.trim()} onPress={send} style={[styles.send, { backgroundColor: colors.primaryFill, opacity: text.trim() ? 1 : 0.5 }]}>
            <Ionicons name="send" size={18} color={colors.onPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, marginHorizontal: Spacing.md, marginTop: Spacing.sm, borderRadius: Radius.xl },
  logo: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.lg, gap: Spacing.md, flexGrow: 1, justifyContent: 'flex-end' },
  bubble: { maxWidth: '82%', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.lg, gap: 2 },
  event: { alignSelf: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Radius.lg, maxWidth: '92%' },
  composer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderTopWidth: 1, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl },
  send: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
