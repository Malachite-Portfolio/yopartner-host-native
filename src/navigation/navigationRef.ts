import { createNavigationContainerRef } from "@react-navigation/native";
import { Linking } from "react-native";
import type { RootStackParamList } from "./types";

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
let signedInNavigationReady = false;
let pendingNotificationRoute: string | null = null;

export function flushPendingNotificationRoute() {
  if (!signedInNavigationReady || !navigationRef.isReady() || !pendingNotificationRoute) return;
  const route = pendingNotificationRoute;
  pendingNotificationRoute = null;
  void Linking.openURL(route);
}

export function setSignedInNavigationReady(ready: boolean) {
  signedInNavigationReady = ready;
  if (!ready) return;
  setTimeout(flushPendingNotificationRoute, 0);
}

export function openNotificationRoute(route: string) {
  pendingNotificationRoute = route;
  flushPendingNotificationRoute();
}

export function isActiveChatSession(sessionId: string) {
  if (!navigationRef.isReady()) return false;
  const route = navigationRef.getCurrentRoute();
  return route?.name === "ChatThread" && (route.params as { sessionId?: string } | undefined)?.sessionId === sessionId;
}

export function showIncomingCall(input: { requestId: string; kind: "AUDIO" | "VIDEO"; callerName?: string }) {
  if (!navigationRef.isReady()) return false;
  const route = navigationRef.getCurrentRoute();
  const currentRequestId = (route?.params as { requestId?: string } | undefined)?.requestId;
  if (route?.name === "IncomingCall" && currentRequestId === input.requestId) return true;
  navigationRef.navigate("IncomingCall", input);
  return true;
}
