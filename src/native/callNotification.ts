import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

type CallNotificationPayload = {
  callId?: string;
  sessionId?: string;
  requestId?: string;
  kind?: "AUDIO" | "VIDEO";
  serviceType?: "AUDIO" | "VIDEO";
  callerName?: string;
};

type CallNotificationModule = {
  showIncomingCallNotification: (payload: CallNotificationPayload) => Promise<boolean>;
  clearIncomingCallNotification: (callId: string) => Promise<boolean>;
  clearAllIncomingCallNotifications: () => Promise<boolean>;
};

const NativeCallNotification = requireOptionalNativeModule<CallNotificationModule>("CallNotification");

export async function showIncomingCallNotification(payload: CallNotificationPayload) {
  const nativeModule = NativeCallNotification;
  if (Platform.OS !== "android" || !nativeModule) return false;
  try {
    return await nativeModule.showIncomingCallNotification(payload);
  } catch (error) {
    console.warn("[call-notification] show failed", error);
    return false;
  }
}

export async function clearIncomingCallNotification(callId: string) {
  const nativeModule = NativeCallNotification;
  if (Platform.OS !== "android" || !nativeModule || !callId.trim()) return false;
  try {
    return await nativeModule.clearIncomingCallNotification(callId);
  } catch (error) {
    console.warn("[call-notification] clear failed", error);
    return false;
  }
}

export async function clearAllIncomingCallNotifications() {
  const nativeModule = NativeCallNotification;
  if (Platform.OS !== "android" || !nativeModule) return false;
  try {
    return await nativeModule.clearAllIncomingCallNotifications();
  } catch (error) {
    console.warn("[call-notification] clear all failed", error);
    return false;
  }
}
