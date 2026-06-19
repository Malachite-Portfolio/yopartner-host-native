import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { BellRing, Home, MessageCircle, UserRound, Wallet } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../auth/AuthProvider";
import { useForegroundActivityNotifications } from "../hooks/useForegroundActivityNotifications";
import { setSignedInNavigationReady } from "./navigationRef";
import { ApplicationStatusScreen } from "../screens/ApplicationStatusScreen";
import { CallScreen } from "../screens/CallScreen";
import { ChatListScreen } from "../screens/ChatListScreen";
import { ChatThreadScreen } from "../screens/ChatThreadScreen";
import { DashboardScreen } from "../screens/DashboardScreen";
import { IncomingCallScreen } from "../screens/IncomingCallScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { RequestsScreen } from "../screens/RequestsScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { SplashScreen } from "../screens/SplashScreen";
import { WalletScreen } from "../screens/WalletScreen";
import { colors } from "../theme/colors";
import { getCurrentPartnerApplicationState } from "../utils/partnerApplication";
import type { MainTabParamList, RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

function LoadingGate() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 66,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarIcon: ({ color }) => <Home size={20} color={color} /> }}
      />
      <Tabs.Screen
        name="Chats"
        component={ChatListScreen}
        options={{ tabBarIcon: ({ color }) => <MessageCircle size={20} color={color} /> }}
      />
      <Tabs.Screen
        name="Requests"
        component={RequestsScreen}
        options={{ tabBarIcon: ({ color }) => <BellRing size={20} color={color} /> }}
      />
      <Tabs.Screen
        name="Wallet"
        component={WalletScreen}
        options={{ tabBarIcon: ({ color }) => <Wallet size={20} color={color} /> }}
      />
      <Tabs.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ color }) => <UserRound size={20} color={color} /> }}
      />
    </Tabs.Navigator>
  );
}

type SignedInStartRoute = "MainTabs" | "Onboarding" | "ApplicationStatus";

async function resolveSignedInStartRoute(): Promise<SignedInStartRoute> {
  const state = await getCurrentPartnerApplicationState();
  const route =
    state.status === "APPROVED"
      ? "MainTabs"
      : !state.hasApplication || state.status === "NOT_STARTED" || state.status === "DRAFT"
        ? "Onboarding"
        : "ApplicationStatus";
  if (Boolean((globalThis as { __DEV__?: boolean }).__DEV__)) {
    console.log("[partner-route] initial route", {
      route,
      status: state.status,
      hasApplication: state.hasApplication,
      dashboardApproved: state.dashboard?.approved ?? null,
      dashboardStatus: state.dashboard?.applicationStatus ?? null,
      kycStatus: state.dashboard?.kycStatus ?? null,
    });
  }
  return route;
}

function SignedInNavigator() {
  const [initialRoute, setInitialRoute] = useState<SignedInStartRoute | null>(null);

  useEffect(() => {
    let mounted = true;
    void resolveSignedInStartRoute()
      .then((route) => {
        if (mounted) setInitialRoute(route);
      })
      .catch((error) => {
        console.warn("[navigation] Unable to resolve partner start route", error);
        if (mounted) setInitialRoute("Onboarding");
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!initialRoute) return <LoadingGate />;

  return (
    <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="ApplicationStatus" component={ApplicationStatusScreen} />
      <Stack.Screen name="ChatThread" component={ChatThreadScreen} />
      <Stack.Screen name="IncomingCall" component={IncomingCallScreen} />
      <Stack.Screen name="Call" component={CallScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}

export function RootNavigator() {
  const { initializing, signedIn } = useAuth();
  useForegroundActivityNotifications(signedIn && !initializing);
  useEffect(() => {
    setSignedInNavigationReady(signedIn && !initializing);
    return () => setSignedInNavigationReady(false);
  }, [initializing, signedIn]);
  if (initializing) return <LoadingGate />;

  if (signedIn) return <SignedInNavigator />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}
