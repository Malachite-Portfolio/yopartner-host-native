import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft, Bell, HelpCircle, LogOut, ShieldCheck } from "lucide-react-native";
import Constants from "expo-constants";
import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthProvider";
import { AppButton } from "../components/AppButton";
import { AppCard } from "../components/AppCard";
import { ScreenContainer } from "../components/ScreenContainer";
import { StatusChip } from "../components/StatusChip";
import { useFcmRegistration } from "../hooks/useFcmRegistration";
import type { RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

export function SettingsScreen({ navigation }: Props) {
  const { logout, phone, signedIn } = useAuth();
  const fcm = useFcmRegistration(signedIn);
  const version = Constants.expoConfig?.version ?? "1.0.0";
  const notificationLabel =
    fcm.status === "registered"
      ? "Notifications active"
      : fcm.status === "denied"
        ? "Notifications disabled"
        : fcm.status === "idle"
          ? "Checking"
          : "Unavailable";

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>
      <ScreenContainer edges={["bottom"]}>
        <AppCard style={styles.card}>
          <View style={styles.row}>
            <Bell size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Notifications</Text>
              <Text style={styles.copy}>{fcm.message || "Checking notification status..."}</Text>
            </View>
            <View style={styles.chipWrap}>
              <StatusChip label={notificationLabel} tone={fcm.status === "registered" ? "green" : fcm.status === "denied" ? "rose" : "slate"} />
            </View>
          </View>
        </AppCard>

        <AppCard style={styles.card}>
          <View style={styles.row}>
            <ShieldCheck size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Signed in</Text>
              <Text style={styles.copy}>{phone || "Firebase partner session"}</Text>
            </View>
          </View>
        </AppCard>

        <AppCard style={styles.card}>
          <Pressable style={styles.row} onPress={() => void Linking.openURL("mailto:support@yopartner.in")}>
            <HelpCircle size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Support</Text>
              <Text style={styles.copy}>Need help with KYC, calls, or payouts?</Text>
            </View>
          </Pressable>
        </AppCard>

        <Text style={styles.version}>YoPartner Host v{version}</Text>
        <AppButton title="Logout" variant="danger" onPress={() => void logout()} />
      </ScreenContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 60, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 12, backgroundColor: colors.background },
  back: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.text, fontWeight: "900", fontSize: 18 },
  card: { marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  chipWrap: { maxWidth: 132, alignItems: "flex-end" },
  title: { color: colors.text, fontWeight: "900", fontSize: 15 },
  copy: { color: colors.textMuted, marginTop: 3, lineHeight: 19 },
  version: { color: colors.textMuted, textAlign: "center", marginVertical: 16, fontWeight: "700" },
});
