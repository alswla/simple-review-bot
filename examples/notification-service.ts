import { EventEmitter } from 'events';

/**
 * Notification preference service
 * Handles user notification settings and dispatch
 */

interface User {
  id: string;
  email: string;
  name: string;
  preferences: NotificationPreference;
}

interface NotificationPreference {
  email: boolean;
  push: boolean;
  sms: boolean;
  quietHoursStart?: string; // "22:00"
  quietHoursEnd?: string;   // "08:00"
}

interface NotificationPayload {
  userId: string;
  type: 'order' | 'promotion' | 'system';
  title: string;
  body: string;
  metadata?: Record<string, string>;
}

const notificationEmitter = new EventEmitter();
const userCache: Map<string, User> = new Map();

/**
 * Fetch user with caching
 */
async function getUser(userId: string, db: any): Promise<User> {
  if (userCache.has(userId)) {
    return userCache.get(userId)!;
  }

  const user = await db.findOne('users', { id: userId });
  userCache.set(userId, user);
  return user;
}

/**
 * Check if current time is within quiet hours
 */
function isQuietHours(pref: NotificationPreference): boolean {
  if (!pref.quietHoursStart || !pref.quietHoursEnd) return false;

  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const current = hours * 60 + minutes;

  const [startH, startM] = pref.quietHoursStart.split(':').map(Number);
  const [endH, endM] = pref.quietHoursEnd.split(':').map(Number);
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;

  if (start > end) {
    // Overnight range (e.g., 22:00 ~ 08:00)
    return current >= start || current < end;
  }
  return current >= start && current < end;
}

/**
 * Send notification to a single user
 */
export async function sendNotification(
  payload: NotificationPayload,
  db: any,
): Promise<{ success: boolean; channels: string[] }> {
  const user = await getUser(payload.userId, db);
  const channels: string[] = [];

  if (isQuietHours(user.preferences)) {
    // Queue for later delivery
    await db.insert('notification_queue', {
      ...payload,
      scheduledAt: user.preferences.quietHoursEnd,
    });
    return { success: true, channels: ['queued'] };
  }

  if (user.preferences.email) {
    await fetch('https://api.mailservice.com/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: user.email,
        subject: payload.title,
        html: `<h1>${payload.title}</h1><p>${payload.body}</p>`,
      }),
    });
    channels.push('email');
  }

  if (user.preferences.push) {
    notificationEmitter.emit('push', {
      userId: user.id,
      title: payload.title,
      body: payload.body,
    });
    channels.push('push');
  }

  if (user.preferences.sms) {
    await fetch('https://api.smsgateway.com/send', {
      method: 'POST',
      body: JSON.stringify({ to: user.id, message: payload.body }),
    });
    channels.push('sms');
  }

  return { success: channels.length > 0, channels };
}

/**
 * Broadcast notification to multiple users
 */
export async function broadcastNotification(
  userIds: string[],
  payload: Omit<NotificationPayload, 'userId'>,
  db: any,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const userId of userIds) {
    try {
      await sendNotification({ ...payload, userId }, db);
      sent++;
    } catch {
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * Update user notification preferences
 */
export async function updatePreferences(
  userId: string,
  newPrefs: Partial<NotificationPreference>,
  db: any,
): Promise<NotificationPreference> {
  const user = await getUser(userId, db);
  const merged = { ...user.preferences, ...newPrefs };

  await db.update('users', { id: userId }, { preferences: merged });
  user.preferences = merged;

  return merged;
}
