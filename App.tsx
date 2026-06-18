import "react-native-gesture-handler";

import { NavigationContainer, type LinkingOptions } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Linking } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/auth/AuthProvider";
import { RootNavigator } from "./src/navigation/RootNavigator";
import type { RootStackParamList } from "./src/navigation/types";
import { colors } from "./src/theme/colors";

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
      Call: "call/:kind/:sessionId",
      ApplicationStatus: "application-status",
    },
  },
};

export default function App() {
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = response.notification.request.content.data?.route;
      if (typeof route === "string" && route.startsWith("yopartnerhost://")) {
        void Linking.openURL(route);
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer linking={linking}>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </AuthProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
