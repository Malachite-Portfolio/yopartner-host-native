import "react-native-gesture-handler";

import { NavigationContainer, type LinkingOptions } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/auth/AuthProvider";
import { flushPendingNotificationRoute, navigationRef, openNotificationRoute } from "./src/navigation/navigationRef";
import { RootNavigator } from "./src/navigation/RootNavigator";
import type { RootStackParamList } from "./src/navigation/types";
import { colors } from "./src/theme/colors";
import { getNotificationRoute, type NotificationData } from "./src/utils/nativeNotifications";

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["yopartnerhost://"],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Dashboard: "dashboard",
          Requests: "requests",
          Chats: "chats",
        },
      } as never,
      ChatThread: "chat/:sessionId",
      IncomingCall: {
        path: "incoming-call/:kind/:requestId",
        parse: {
          kind: (value) => value.toUpperCase(),
          action: (value) => {
            const action = value.toLowerCase();
            return action === "accept" || action === "decline" ? action : "open";
          },
        },
      },
      Call: {
        path: "call/:kind/:sessionId",
        parse: { kind: (value) => value.toUpperCase() },
      },
      ApplicationStatus: "application-status",
    },
  },
};

export default function App() {
  useEffect(() => {
    const handledResponses = new Set<string>();
    const openResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const identifier = response.notification.request.identifier;
      if (handledResponses.has(identifier)) return;
      handledResponses.add(identifier);
      const data = response.notification.request.content.data as NotificationData;
      const suppliedRoute = data?.route;
      const route = typeof suppliedRoute === "string" && suppliedRoute.startsWith("yopartnerhost://")
        ? suppliedRoute
        : getNotificationRoute(data ?? {});
      openNotificationRoute(route);
      void Notifications.clearLastNotificationResponseAsync();
    };
    void Notifications.getLastNotificationResponseAsync().then(openResponse);
    const subscription = Notifications.addNotificationResponseReceivedListener(openResponse);
    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef} linking={linking} onReady={flushPendingNotificationRoute}>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </AuthProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
