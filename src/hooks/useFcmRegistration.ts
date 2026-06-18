import messaging from "@react-native-firebase/messaging";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { registerPartnerFcmToken } from "../api/notifications";
import { savePartnerExpoPushToken, savePartnerFcmToken } from "../auth/tokenStore";
import { configureAndroidNotificationChannels, displayPartnerNotification } from "../utils/nativeNotifications";

type FcmStatus = "idle" | "registered" | "denied" | "unavailable" | "error";

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

export function useFcmRegistration(enabled: boolean) {
  const [status, setStatus] = useState<FcmStatus>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const registerFcmToken = async (token: string) => {
      try {
        await savePartnerFcmToken(token);
        const response = await registerPartnerFcmToken(token);
        if (response.error && isDebugBuild()) {
          console.warn("[notifications] FCM registration failed", response.error);
        }
      } catch (error) {
        if (isDebugBuild()) console.warn("[notifications] FCM registration crashed", error);
      }
    };

    void (async () => {
      try {
        if (!Device.isDevice) {
          setStatus("unavailable");
          setMessage("Notifications require a physical device.");
          return;
        }
        await configureAndroidNotificationChannels();
        await Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
        const allowed = await requestNotificationPermission();
        if (!allowed) {
          setStatus("denied");
          setMessage("Enable notifications in device settings to receive chat and call alerts.");
          return;
        }

        let hasPushToken = false;
        try {
          const projectId = getExpoProjectId();
          const expoToken = await Notifications.getExpoPushTokenAsync(
            projectId ? { projectId } : undefined,
          );
          await savePartnerExpoPushToken(expoToken.data);
          hasPushToken = true;
        } catch (error) {
          if (isDebugBuild()) console.warn("[notifications] Expo push token unavailable", error);
        }

        if (Platform.OS === "android") {
          const fcmToken = await messaging().getToken();
          hasPushToken = true;
          void registerFcmToken(fcmToken);
        }

        if (!hasPushToken) throw new Error("No push token was returned.");
        if (!cancelled) {
          setStatus("registered");
          setMessage("Notifications ready.");
        }
      } catch (error) {
        if (cancelled) return;
        if (isDebugBuild()) console.warn("[notifications] FCM registration crashed", error);
        setStatus("error");
        setMessage("Notifications are unavailable right now. Dashboard updates will still work.");
      }
    })();

    const unsubscribeTokenRefresh = messaging().onTokenRefresh((token) => {
      void registerFcmToken(token);
    });
    const unsubscribeMessage = messaging().onMessage((remoteMessage) => {
      void displayPartnerNotification(remoteMessage).catch((error) => {
        if (isDebugBuild()) console.warn("[notifications] foreground display failed", error);
      });
    });

    return () => {
      cancelled = true;
      unsubscribeTokenRefresh();
      unsubscribeMessage();
    };
  }, [enabled]);

  return { status, message };
}
