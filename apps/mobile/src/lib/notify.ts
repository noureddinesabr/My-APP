import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Phone notifications scheduled on the device, so booking reminders arrive even when
 * the app is closed. On the web (the preview) this does nothing; reminders show in the app.
 */
const supported = Platform.OS !== 'web';

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function allowed() {
  if (!supported) return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

/** Asks for notification permission (once), e.g. right after a request is sent, so offers can reach the phone. */
export async function ensureNotifications() {
  return allowed();
}

export type Reminder = { id: string; at: number; title: string; body: string };

/** Replaces the reminders scheduled for a job with these (past times are skipped). */
export async function scheduleReminders(jobId: string, reminders: Reminder[]) {
  if (!(await allowed())) return;
  await cancelReminders(jobId);
  for (const reminder of reminders) {
    if (reminder.at <= Date.now()) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: `${jobId}:${reminder.id}`,
      content: { title: reminder.title, body: reminder.body, data: { jobId } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.at },
    }).catch(() => {});
  }
}

export async function cancelReminders(jobId: string) {
  if (!supported) return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((item) => item.identifier.startsWith(`${jobId}:`))
        .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
    );
  } catch {
    // Nothing to cancel.
  }
}

/** Shows a notification right away (e.g. offer accepted while the app is in the background). */
export async function notifyNow(title: string, body: string) {
  if (!(await allowed())) return;
  await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null }).catch(() => {});
}
