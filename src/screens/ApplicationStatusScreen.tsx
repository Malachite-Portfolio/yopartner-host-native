import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { ArrowLeft, CheckCircle2, Clock3, FileWarning } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthProvider";
import { AppButton } from "../components/AppButton";
import { AppCard } from "../components/AppCard";
import { LoadingState } from "../components/LoadingState";
import { ScreenContainer } from "../components/ScreenContainer";
import { StatusChip } from "../components/StatusChip";
import type { RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { getCurrentPartnerApplicationState, type PartnerApplicationRouteState } from "../utils/partnerApplication";

type Props = NativeStackScreenProps<RootStackParamList, "ApplicationStatus">;

export function ApplicationStatusScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<PartnerApplicationRouteState>("NOT_STARTED");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const state = await getCurrentPartnerApplicationState();
    if (state.status === "APPROVED") {
      navigation.replace("MainTabs");
      return;
    }
    setStatus(state.status);
    setMessage(state.message);
    setLoading(false);
    setRefreshing(false);
  }, [navigation]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void load();
    });
    return () => subscription.remove();
  }, [load]);

  const approved = status === "APPROVED";
  const rejected = status === "REJECTED";
  const needsInfo = status === "NEEDS_INFO";
  const notStarted = status === "NOT_STARTED";
  const canEditApplication = rejected || needsInfo || notStarted;

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.header}>
          <Pressable style={styles.back} onPress={() => navigation.goBack()}>
            <ArrowLeft size={20} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Application Status</Text>
        </View>
      </SafeAreaView>
      <ScreenContainer refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }}>
        {loading ? <LoadingState label="Checking application..." /> : null}
        <AppCard style={styles.hero}>
          <View style={[styles.statusIcon, approved && styles.approvedIcon, rejected && styles.rejectedIcon]}>
            {approved ? <CheckCircle2 size={28} color={colors.white} /> : rejected || needsInfo ? <FileWarning size={28} color={colors.white} /> : <Clock3 size={28} color={colors.white} />}
          </View>
          <Text style={styles.title}>
            {approved ? "You are approved" : rejected ? "Application rejected" : needsInfo ? "More information needed" : notStarted ? "Start your host application" : "Your profile is under review"}
          </Text>
          <Text style={styles.copy}>
            {message || (rejected ? "You can apply again with updated details." : "YoPartner safety team reviews profile details and verification documents before requests are enabled.")}
          </Text>
          <StatusChip label={status.replace(/_/g, " ")} tone={approved ? "green" : rejected ? "rose" : "amber"} />
        </AppCard>

        <AppCard>
          <Text style={styles.sectionTitle}>Verification checklist</Text>
          {["Profile submitted", "Selfie selected", "Aadhaar front selected", "Aadhaar back selected", "Safety review"].map((item, index) => (
            <View key={item} style={styles.stepRow}>
              <View style={[styles.stepDot, index < 1 && styles.stepDone]} />
              <Text style={styles.stepText}>{item}</Text>
            </View>
          ))}
          {canEditApplication ? (
            <View style={styles.actions}>
              <AppButton title={rejected ? "Apply Again" : needsInfo ? "Update & Resubmit" : "Start Application"} onPress={() => navigation.navigate("Onboarding")} />
              <AppButton title="Logout" variant="secondary" onPress={() => void logout()} />
            </View>
          ) : null}
          {status === "PENDING" ? <Text style={styles.pendingNote}>Under Review</Text> : null}
        </AppCard>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  safeArea: { backgroundColor: colors.background },
  header: { height: 72, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 12, backgroundColor: colors.background },
  back: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.text, fontWeight: "900", fontSize: 18 },
  hero: { alignItems: "center", marginBottom: 14 },
  statusIcon: { width: 66, height: 66, borderRadius: 33, backgroundColor: colors.amber, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  approvedIcon: { backgroundColor: colors.primary },
  rejectedIcon: { backgroundColor: colors.danger },
  title: { color: colors.text, fontWeight: "900", fontSize: 22, textAlign: "center" },
  copy: { color: colors.textMuted, textAlign: "center", lineHeight: 21, marginVertical: 10 },
  sectionTitle: { color: colors.text, fontWeight: "900", fontSize: 17, marginBottom: 10 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  stepDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.borderStrong },
  stepDone: { backgroundColor: colors.primary },
  stepText: { color: colors.text, fontWeight: "700" },
  actions: { gap: 10, marginTop: 14 },
  pendingNote: { color: colors.amber, fontWeight: "900", marginTop: 14, textAlign: "center" },
});
