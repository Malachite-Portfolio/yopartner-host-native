import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Phone, Video, MessageCircle } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { AppState, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { acceptPartnerRequest, declinePartnerRequest, getPartnerDashboard } from "../api/partner";
import { endSession } from "../api/sessions";
import { AppButton } from "../components/AppButton";
import { AppCard } from "../components/AppCard";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { ScreenHeader } from "../components/ScreenHeader";
import { StatusChip } from "../components/StatusChip";
import { useInterval } from "../hooks/useInterval";
import type { RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import type { PartnerActiveSession, PartnerDashboardPayload, PartnerIncomingRequest, SessionKind } from "../types/api";
import { formatINR, maskPhone } from "../utils/format";
import { getRequestMemberLabel, isApproved, isRawOnline } from "../utils/partner";

type RootNav = NativeStackNavigationProp<RootStackParamList>;

function RequestIcon({ type }: { type: SessionKind }) {
  const color = type === "VIDEO" ? "#7c3aed" : type === "AUDIO" ? colors.primary : "#2563eb";
  if (type === "VIDEO") return <Video size={20} color={color} />;
  if (type === "AUDIO") return <Phone size={20} color={color} />;
  return <MessageCircle size={20} color={color} />;
}

export function RequestsScreen() {
  const navigation = useNavigation<RootNav>();
  const [dashboard, setDashboard] = useState<PartnerDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await getPartnerDashboard();
    if (response.data) {
      setDashboard(response.data);
      setMessage("");
    } else if (response.error) {
      setMessage(response.error.message);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

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

  useInterval(() => {
    void load();
  }, isApproved(dashboard) && isRawOnline(dashboard) ? 5000 : null);

  const pending = dashboard?.pendingRequests ?? [];
  const active = dashboard?.activeSessions ?? [];

  const accept = async (request: PartnerIncomingRequest) => {
    setActionId(request.id);
    const response = await acceptPartnerRequest(request.id);
    setActionId(null);
    if (response.error) {
      setMessage(response.error.message);
      return;
    }
    if (request.type === "CHAT") navigation.navigate("ChatThread", { sessionId: request.id });
    else navigation.navigate("Call", { sessionId: request.id, kind: request.type });
  };

  const decline = async (request: PartnerIncomingRequest) => {
    setActionId(request.id);
    const response = await declinePartnerRequest(request.id);
    setActionId(null);
    if (response.error) setMessage(response.error.message);
    await load();
  };

  const join = (session: PartnerActiveSession) => {
    if (session.type === "CHAT") navigation.navigate("ChatThread", { sessionId: session.id });
    else navigation.navigate("Call", { sessionId: session.id, kind: session.type });
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Requests" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        {loading ? <LoadingState label="Checking incoming requests..." /> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}

        {pending.length > 0 ? (
          <AppCard style={styles.incomingCard}>
            <Text style={styles.incomingLabel}>Incoming now</Text>
            {pending.map((request) => (
              <View key={request.id} style={styles.requestRow}>
                <View style={styles.iconBubble}>
                  <RequestIcon type={request.type} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{request.type === "CHAT" ? "Incoming chat request" : `Incoming ${request.type.toLowerCase()} call`}</Text>
                  <Text style={styles.meta}>{maskPhone(getRequestMemberLabel(request))} - {formatINR(request.expectedRate)}</Text>
                </View>
                <View style={styles.actions}>
                  <AppButton title="Accept" loading={actionId === request.id} onPress={() => void accept(request)} style={styles.actionButton} />
                  <AppButton title="Decline" variant="secondary" onPress={() => void decline(request)} style={styles.actionButton} />
                </View>
              </View>
            ))}
          </AppCard>
        ) : !loading ? (
          <AppCard style={styles.cardGap}>
            <EmptyState title="No one is waiting" message="New chat and call requests will appear here with quick accept and decline actions." />
          </AppCard>
        ) : null}

        <AppCard style={styles.cardGap}>
          <Text style={styles.sectionTitle}>Ongoing conversations</Text>
          {active.length === 0 ? <Text style={styles.emptyLine}>No active conversations right now.</Text> : null}
          {active.map((session) => (
            <View key={session.id} style={styles.activeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{maskPhone(session.memberPhoneMasked || session.memberLabel)}</Text>
                <Text style={styles.meta}>{session.type} - {session.status || "LIVE"}</Text>
              </View>
              <StatusChip label={session.status || "LIVE"} tone={session.status === "LIVE" ? "green" : "amber"} />
              <Pressable style={styles.joinButton} onPress={() => join(session)}>
                <Text style={styles.joinText}>Join</Text>
              </Pressable>
              <Pressable style={styles.endButton} onPress={() => void endSession(session.id).then(load)}>
                <Text style={styles.endText}>End</Text>
              </Pressable>
            </View>
          ))}
        </AppCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 28 },
  message: { color: colors.danger, fontWeight: "700", marginBottom: 12 },
  incomingCard: { backgroundColor: colors.surfaceWarm, borderColor: "#fde68a", marginBottom: 14 },
  incomingLabel: { color: colors.amber, fontWeight: "900", marginBottom: 10, textTransform: "uppercase", fontSize: 12 },
  requestRow: { flexDirection: "row", gap: 12, alignItems: "center", borderTopWidth: 1, borderTopColor: "#fde68a", paddingTop: 12, marginTop: 10 },
  iconBubble: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontWeight: "900", fontSize: 15 },
  meta: { color: colors.textMuted, marginTop: 4, fontSize: 12 },
  actions: { gap: 7 },
  actionButton: { minHeight: 36, paddingHorizontal: 12 },
  cardGap: { marginBottom: 14 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "900", marginBottom: 8 },
  emptyLine: { color: colors.textMuted, lineHeight: 20 },
  activeRow: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 10 },
  joinButton: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 9 },
  joinText: { color: colors.text, fontWeight: "900" },
  endButton: { borderRadius: 12, backgroundColor: colors.dangerSoft, paddingHorizontal: 12, paddingVertical: 9 },
  endText: { color: colors.danger, fontWeight: "900" },
});
