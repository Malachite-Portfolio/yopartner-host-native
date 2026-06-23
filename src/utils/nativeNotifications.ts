import * as Notifications from "expo-notifications";
import type { FirebaseMessagingTypes } from "@react-native-firebase/messaging";
import { showIncomingCallNotification } from "../native/callNotification";

export type NotificationData = Record<string, string | object | undefined>;

export const CHAT_NOTIFICATION_CHANNEL = "chat-messages";
export const CALL_NOTIFICATION_CHANNEL = "incoming-calls";
const SYSTEM_NOTIFICATION_CHANNEL = "system";
const recentNotificationKeys = new Map<string, number>();
const DEDUPE_WINDOW_MS = 60_000;

function stringifyValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value == null) return "";
  return String(value).trim();
}

function normalizedEvent(data: NotificationData) {
  return stringifyValue(data.type || data.event).toUpperCase();
}

export function getNotificationSessionId(data: NotificationData) {
  return stringifyValue(
    data.sessionId || data.requestId || data.callId || data.chatId || data.conversationId || data.threadId,
  );
}

export function getNotificationServiceType(data: NotificationData) {
  const value = stringifyValue(data.serviceType || data.kind).toUpperCase();
  return value === "VIDEO" ? "VIDEO" : value === "AUDIO" ? "AUDIO" : null;
}

export function getNotificationCallerName(data: NotificationData) {
  return stringifyValue(data.callerName || data.memberName || data.name || data.displayName);
}

export function isChatNotification(data: NotificationData) {
  const event = normalizedEvent(data);
  const channel = stringifyValue(data.channel).toLowerCase();
  return event.includes("CHAT") || event.includes("MESSAGE") || channel === "chat" || channel === "chats" || channel === CHAT_NOTIFICATION_CHANNEL;
}

export function isCallNotification(data: NotificationData) {
  const event = normalizedEvent(data);
  const channel = stringifyValue(data.channel).toLowerCase();
  const serviceType = getNotificationServiceType(data);
  const incomingCallRequest = event === "PARTNER_INCOMING_REQUEST" && Boolean(serviceType);
  return event.includes("CALL") || incomingCallRequest || channel === "call" || channel === "calls" || channel === CALL_NOTIFICATION_CHANNEL;
}

function notificationChannel(data: NotificationData) {
  if (isCallNotification(data)) return CALL_NOTIFICATION_CHANNEL;
  if (isChatNotification(data)) return CHAT_NOTIFICATION_CHANNEL;
  return SYSTEM_NOTIFICATION_CHANNEL;
}

function isDuplicateNotification(key: string) {
  const now = Date.now();
  recentNotificationKeys.forEach((createdAt, existingKey) => {
    if (now - createdAt > DEDUPE_WINDOW_MS) recentNotificationKeys.delete(existingKey);
  });
  if (recentNotificationKeys.has(key)) return true;
  recentNotificationKeys.set(key, now);
  return false;
}

export async function configureAndroidNotificationChannels() {
  await Promise.all([
    Notifications.setNotificationChannelAsync(CHAT_NOTIFICATION_CHANNEL, {
      name: "Chat messages",
      importance: Notifications.AndroidImportance.HIGH,
      enableVibrate: true,
      vibrationPattern: [0, 180, 120, 180],
      sound: "default",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }),
    Notifications.setNotificationChannelAsync(CALL_NOTIFICATION_CHANNEL, {
      name: "Incoming calls",
      importance: Notifications.AndroidImportance.MAX,
      enableVibrate: true,
      vibrationPattern: [0, 700, 350, 700, 350, 700],
      sound: "default",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }),
    Notifications.setNotificationChannelAsync(SYSTEM_NOTIFICATION_CHANNEL, {
      name: "System",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 120],
      sound: "default",
    }),
  ]);
}

export function getNotificationRoute(data: NotificationData) {
  const sessionId = getNotificationSessionId(data);
  if (isChatNotification(data)) {
    return sessionId ? `yopartnerhost://chat/${encodeURIComponent(sessionId)}` : "yopartnerhost://chats";
  }
  if (isCallNotification(data)) {
    const serviceType = getNotificationServiceType(data);
    if (sessionId && serviceType) {
      return `yopartnerhost://incoming-call/${serviceType.toLowerCase()}/${encodeURIComponent(sessionId)}?action=open`;
    }
    return "yopartnerhost://dashboard";
  }
  return "yopartnerhost://dashboard";
}

type LocalNotificationInput = {
  data: NotificationData;
  title?: string;
  body?: string;
  dedupeKey?: string;
};

export async function showPartnerLocalNotification(input: LocalNotificationInput) {
  const data = input.data;
  const sessionId = getNotificationSessionId(data);
  const body = input.body || stringifyValue(data.body || data.message) || "Open YoPartner Host to view the latest update.";
  const key = input.dedupeKey || stringifyValue(data.messageId || data.callId) || `${normalizedEvent(data)}:${sessionId}:${body}`;
  if (key && isDuplicateNotification(key)) return false;

  const channelId = notificationChannel(data);
  if (channelId === CALL_NOTIFICATION_CHANNEL) {
    const serviceType = getNotificationServiceType(data);
    if (sessionId && serviceType) {
      const displayed = await showIncomingCallNotification({
        callId: sessionId,
        sessionId,
        requestId: sessionId,
        kind: serviceType,
        serviceType,
        callerName: getNotificationCallerName(data) || "YoPartner member",
      });
      if (displayed) return true;
    }
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: input.title || stringifyValue(data.title) || "YoPartner Host",
      body,
      data: {
        ...data,
        route: getNotificationRoute(data),
      },
      sound: "default",
      priority: channelId === CALL_NOTIFICATION_CHANNEL
        ? Notifications.AndroidNotificationPriority.MAX
        : Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      channelId,
      seconds: 1,
    },
  });
  return true;
}

export async function displayPartnerNotification(message: FirebaseMessagingTypes.RemoteMessage) {
  const data = (message.data ?? {}) as NotificationData;
  return showPartnerLocalNotification({
    data,
    title: message.notification?.title || stringifyValue(data.title),
    body: message.notification?.body || stringifyValue(data.body || data.message),
    dedupeKey: message.messageId || stringifyValue(data.messageId || data.callId),
  });
}

// Background/killed chat and call notifications require backend FCM sender events.
// The native app can receive and handle them, but cannot create them while killed.
