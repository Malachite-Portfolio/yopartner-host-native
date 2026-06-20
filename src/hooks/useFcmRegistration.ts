import messaging from "@react-native-firebase/messaging";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { registerPartnerFcmToken } from "../api/notifications";
import {
  getPartnerExpoPushToken,
  getPartnerFcmToken,
  savePartnerExpoPushToken,
  savePartnerFcmToken,
} from "../auth/tokenStore";
import { isActiveChatSession, showIncomingCall } from "../navigation/navigationRef";
import { stopCallRingtone } from "../native/callRingtone";
import {
  configureAndroidNotificationChannels,
  displayPartnerNotification,
  getNotificationServiceType,
  getNotificationSessionId,
  isCallNotification,
  isChatNotification,
  type NotificationData,
} from "../utils/nativeNotifications";

type FcmStatus = "idle" | "registered" | "denied" | "unavailable" | "error";
type FcmState = { status: FcmStatus; message: string };

const IDLE_STATE: FcmState = { status: "idle", message: "" };
let sharedState: FcmState = IDLE_STATE;
let activeConsumers = 0;
let registrationStarted = false;
let registrationGeneration = 0;
let unsubscribeTokenRefresh: (() => void) | null = null;
let unsubscribeMessage: (() => void) | null = null;
let unsubscribeAppState: (() => void) | null = null;
const subscribers = new Set<(state: FcmState) => void>();

function isDebugBuild() {
  return Boolean((globalThis as { __DEV__?: boolean }).__DEV__);
}

function getExpoProjectId() {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined;
  const projectId = Constants.easConfig?.projectId ?? extra?.eas?.projectId;
  return typeof projectId === "string" && projectId.trim() ? projectId.trim() : undefined;
}

async function requestNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

function publish(state: FcmState) {
  sharedState = state;
  subscribers.forEach((subscriber) => subscriber(state));
}

async function registerTokenWithBackend(token: string) {
  try {
    const response = await registerPartnerFcmToken(token);
    if (response.error && isDebugBuild()) {
      console.warn("[notifications] FCM registration failed", response.error);
    }
  } catch (error) {
    if (isDebugBuild()) console.warn("[notifications] FCM registration crashed", error);
  }
}

async function saveFcmToken(token: string, generation: number) {
  const normalized = token.trim();
  if (!normalized) throw new Error("No FCM token was returned.");
  await savePartnerFcmToken(normalized);
  if (generation === registrationGeneration) {
    publish({ status: "registered", message: "Notifications ready." });
  }
  void registerTokenWithBackend(normalized);
}

async function startRegistration(generation: number) {
  try {
    if (!Device.isDevice) {
      publish({ status: "unavailable", message: "Notifications are unavailable on this emulator or simulator." });
      return;
    }

    try {
      await configureAndroidNotificationChannels();
    } catch (error) {
      if (isDebugBuild()) console.warn("[notifications] channel setup failed", error);
    }

    const allowed = await requestNotificationPermission();
    if (generation !== registrationGeneration) return;
    if (!allowed) {
      publish({ status: "denied", message: "Notifications disabled. Enable them in device settings to receive chat and call alerts." });
      return;
    }

    try {
      await Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    } catch (error) {
      if (isDebugBuild()) console.warn("[notifications] foreground handler setup failed", error);
    }

    const [savedExpoToken, savedFcmToken] = await Promise.all([
      getPartnerExpoPushToken().catch(() => null),
      getPartnerFcmToken().catch(() => null),
    ]);
    let expoToken = savedExpoToken;
    let fcmToken = savedFcmToken;

    if (fcmToken && generation === registrationGeneration) {
      publish({ status: "registered", message: "Notifications ready." });
      void registerTokenWithBackend(fcmToken);
    }

    try {
      const projectId = getExpoProjectId();
      const response = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      const nextExpoToken = response.data?.trim();
      if (nextExpoToken) {
        await savePartnerExpoPushToken(nextExpoToken);
        expoToken = nextExpoToken;
      }
    } catch (error) {
      if (isDebugBuild()) console.warn("[notifications] Expo push token unavailable", error);
    }

    if (Platform.OS === "android") {
      try {
        const nextFcmToken = await messaging().getToken();
        const normalizedFcmToken = nextFcmToken.trim();
        if (!normalizedFcmToken) throw new Error("No FCM token was returned.");
        if (normalizedFcmToken !== fcmToken) {
          await saveFcmToken(normalizedFcmToken, generation);
        }
        fcmToken = normalizedFcmToken;
      } catch (error) {
        if (isDebugBuild()) console.warn("[notifications] FCM token unavailable", error);
      }
    } else if (expoToken && generation === registrationGeneration) {
      publish({ status: "registered", message: "Notifications ready." });
    }

    if (generation !== registrationGeneration) return;
    if (Platform.OS === "android" && !fcmToken) {
      publish({
        status: "unavailable",
        message: expoToken
          ? "Expo push token saved, but Android notification registration is unavailable right now."
          : "Notifications are unavailable right now. Dashboard updates will still work.",
      });
      return;
    }
    if (Platform.OS !== "android" && !expoToken) {
      publish({ status: "unavailable", message: "Notifications are unavailable on this device right now." });
      return;
    }

    unsubscribeTokenRefresh = messaging().onTokenRefresh((token) => {
      void saveFcmToken(token, registrationGeneration).catch((error) => {
        if (isDebugBuild()) console.warn("[notifications] refreshed token could not be saved", error);
      });
    });
    unsubscribeMessage = messaging().onMessage((remoteMessage) => {
      const data = (remoteMessage.data ?? {}) as NotificationData;
      const sessionId = getNotificationSessionId(data);
      if (sessionId && isChatNotification(data) && isActiveChatSession(sessionId)) return;
      const serviceType = getNotificationServiceType(data);
      if (sessionId && serviceType && isCallNotification(data)) {
        const callerName = typeof data.callerName === "string" ? data.callerName : undefined;
        if (showIncomingCall({ requestId: sessionId, kind: serviceType, callerName })) return;
      }
      void displayPartnerNotification(remoteMessage).catch((error) => {
        if (isDebugBuild()) console.warn("[notifications] foreground display failed", error);
      });
    });
  } catch (error) {
    if (generation !== registrationGeneration) return;
    if (isDebugBuild()) console.warn("[notifications] setup failed", error);
    publish({ status: "error", message: "Notifications are unavailable right now. Dashboard updates will still work." });
  }
}

function ensureRegistration() {
  if (registrationStarted) return;
  registrationStarted = true;
  const generation = ++registrationGeneration;
  if (!unsubscribeAppState) {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active" || activeConsumers === 0 || sharedState.status === "registered") return;
      registrationStarted = false;
      ensureRegistration();
    });
    unsubscribeAppState = () => subscription.remove();
  }
  void startRegistration(generation);
}

function stopRegistration() {
  stopCallRingtone();
  registrationGeneration += 1;
  registrationStarted = false;
  unsubscribeTokenRefresh?.();
  unsubscribeMessage?.();
  unsubscribeAppState?.();
  unsubscribeTokenRefresh = null;
  unsubscribeMessage = null;
  unsubscribeAppState = null;
  sharedState = IDLE_STATE;
}

export function useFcmRegistration(enabled: boolean) {
  const [state, setState] = useState<FcmState>(sharedState);

  useEffect(() => {
    if (!enabled) {
      setState(IDLE_STATE);
      return;
    }

    activeConsumers += 1;
    subscribers.add(setState);
    setState(sharedState);
    ensureRegistration();

    return () => {
      subscribers.delete(setState);
      activeConsumers = Math.max(0, activeConsumers - 1);
      if (activeConsumers === 0) stopRegistration();
    };
  }, [enabled]);

  return state;
}
