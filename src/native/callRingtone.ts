import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

type CallRingtoneNativeModule = {
  start: () => Promise<void> | void;
  stop: () => Promise<void> | void;
  isPlaying: () => boolean;
};

const nativeModule = Platform.OS === "android"
  ? requireOptionalNativeModule<CallRingtoneNativeModule>("CallRingtone")
  : null;

function safelyInvoke(operation: "start" | "stop") {
  if (!nativeModule) return;
  try {
    void Promise.resolve(nativeModule[operation]()).catch(() => {
      console.info("[call-ringtone] Call ringtone unavailable");
    });
  } catch {
    console.info("[call-ringtone] Call ringtone unavailable");
  }
}

export function startCallRingtone() {
  safelyInvoke("start");
}

export function stopCallRingtone() {
  safelyInvoke("stop");
}
