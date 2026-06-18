import * as Notifications from "expo-notifications";
import type { FirebaseMessagingTypes } from "@react-native-firebase/messaging";

type NotificationData = Record<string, string | object | undefined>;

function stringifyValue(value: unknown) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

export async function configureAndroidNotificationChannels() {
  await Promise.all([
    Notifications.setNotificationChannelAsync("calls", {
      name: "Calls",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default",
    }),
    Notifications.setNotificationChannelAsync("chats", {
      name: "Chats",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180],
      sound: "default",
    }),
    Notifications.setNotificationChannelAsync("system", {
      name: "System",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 120],
      sound: "default",
    }),
  ]);
}

export function getNotificationRoute(data: NotificationData) {
  const type = stringifyValue(data.type);
  const sessionId = stringifyValue(data.sessionId || data.requestId);
  const serviceType = stringifyValue(data.serviceType);
  if (type === "PARTNER_CHAT_MESSAGE" && sessionId) return `yopartnerhost://chat/${encodeURIComponent(sessionId)}`;
  if (type === "PARTNER_INCOMING_REQUEST" && sessionId && serviceType === "AUDIO") {
    return `yopartnerhost://call/audio/${encodeURIComponent(sessionId)}`;
  }
  if (type === "PARTNER_INCOMING_REQUEST" && sessionId && serviceType === "VIDEO") {
    return `yopartnerhost://call/video/${encodeURIComponent(sessionId)}`;
  }
  return "yopartnerhost://requests";
}

export async function displayPartnerNotification(message: FirebaseMessagingTypes.RemoteMessage) {
  const data = (message.data ?? {}) as NotificationData;
  const rawChannel = stringifyValue(data.channel);
  const channelId = rawChannel === "calls" ? "calls" : rawChannel === "chat" || rawChannel === "chats" ? "chats" : "system";
  const title = message.notification?.title || stringifyValue(data.title) || "YoPartner Host";
  const body = message.notification?.body || stringifyValue(data.body) || "Open YoPartner Host to view the latest update.";

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: {
        ...data,
        route: getNotificationRoute(data),
      },
      sound: "default",
    },
    trigger: {
      channelId,
      seconds: 1,
    },
  });
}
