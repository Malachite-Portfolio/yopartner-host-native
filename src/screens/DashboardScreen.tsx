import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BellRing, FileCheck2, MessageCircle, Phone, Settings, Video } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppState, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { acceptPartnerRequest, declinePartnerRequest, getPartnerDashboard, getPartnerProfile, getPartnerProfileMedia, heartbeatPresence, markPresenceOffline, markPresenceOnline } from "../api/partner";
import { endSession } from "../api/sessions";
import { useAuth } from "../auth/AuthProvider";
import { AppButton } from "../components/AppButton";
import { AppCard } from "../components/AppCard";
import { Avatar } from "../components/Avatar";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { MetricCard } from "../components/MetricCard";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionHeader } from "../components/SectionHeader";
import { StatusChip } from "../components/StatusChip";
import { useFcmRegistration } from "../hooks/useFcmRegistration";
import { useInterval } from "../hooks/useInterval";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { sharedStyles } from "../theme/styles";
import type { AvailabilityStatus, PartnerActiveSession, PartnerDashboardPayload, PartnerIncomingRequest } from "../types/api";
import { formatINR, maskPhone } from "../utils/format";
import { getApprovalState, getAvailabilityStatus, getRequestMemberLabel, isApproved, isRawOnline } from "../utils/partner";

type Props = BottomTabScreenProps<MainTabParamList, "Dashboard">;
type RootNav = NativeStackNavigationProp<RootStackParamList>;

function statusTone(status: AvailabilityStatus) {
  if (status === "ONLINE") return "green";
  if (status === "BUSY") return "amber";
  return "slate";
}

function isDebugBuild() {
  return Boolean((globalThis as { __DEV__?: boolean }).__DEV__);
}

export function DashboardScreen({ navigation }: Props) {
  const rootNavigation = useNavigation<RootNav>();
  const { phone, signedIn } = useAuth();
  const [dashboard, setDashboard] = useState<PartnerDashboardPayload | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState("");
  const status: AvailabilityStatus = getAvailabilityStatus(dashboard);
  const stats = dashboard?.stats ?? {};
  const labels = getApprovalState(dashboard);
  const pending = dashboard?.pendingRequests ?? [];
  const active = dashboard?.activeSessions ?? [];
  const online = isRawOnline(dashboard);
  const approved = isApproved(dashboard);
  const fcm = useFcmRegistration(signedIn);

  const load = useCallback(async () => {
    const [response, profileResponse, media] = await Promise.all([
      getPartnerDashboard(),
      getPartnerProfile(),
      getPartnerProfileMedia(),
    ]);
    if (response.data) {
      setDashboard(response.data);
      setMessage(isApproved(response.data) ? "Partner dashboard ready." : response.data.message || "");
    } else if (response.error) {
      setMessage(response.error.message);
    }
    if (profileResponse.data) setProfile(profileResponse.data);
    if (media.data) {
      setProfileImageUrl(media.data.resolvedProfileImageUrl || media.data.profileImageUrl || null);
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
  }, approved && online ? 5000 : null);

  useInterval(() => {
    const raw = Boolean(dashboard?.availability?.rawIsOnline ?? dashboard?.availability?.isOnline);
    if (raw) void heartbeatPresence();
  }, 25000);

  const debugIdentity = dashboard?.debugIdentity && typeof dashboard.debugIdentity === "object"
    ? (dashboard.debugIdentity as Record<string, unknown>)
    : {};

  const hostName = useMemo(() => {
    const asRecord = (value: unknown) => value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
    const scopes = [
      asRecord(profile),
      asRecord(profile?.profile),
      asRecord(profile?.companion),
      asRecord(profile?.application),
      asRecord(dashboard?.companion),
      asRecord(dashboard?.application),
    ];
    for (const key of ["displayName", "name", "fullName", "partnerName"]) {
      for (const scope of scopes) {
        const value = scope[key];
        if (typeof value === "string" && value.trim()) return value.trim();
      }
    }
    const profilePhone = scopes
      .map((scope) => scope.phoneNumber ?? scope.phone)
      .find((value) => typeof value === "string" && value.trim());
    const fallbackPhone = typeof profilePhone === "string" ? profilePhone : phone;
    return fallbackPhone ? maskPhone(fallbackPhone) : "Partner";
  }, [dashboard, phone, profile]);

  const toggleAvailability = async () => {
    if (!approved) {
      setMessage("Your host profile must be approved before accepting requests.");
      return;
    }
    setUpdating(true);
    const response = online ? await markPresenceOffline() : await markPresenceOnline();
    if (response.error) setMessage(response.error.message);
    await load();
    setUpdating(false);
  };

  const handleAccept = async (request: PartnerIncomingRequest) => {
    const response = await acceptPartnerRequest(request.id);
    if (response.error) {
      setMessage(response.error.message);
      return;
    }
    if (request.type === "CHAT") rootNavigation.navigate("ChatThread", { sessionId: request.id });
    else rootNavigation.navigate("Call", { sessionId: request.id, kind: request.type });
  };

  const handleDecline = async (request: PartnerIncomingRequest) => {
    const response = await declinePartnerRequest(request.id);
    if (response.error) setMessage(response.error.message);
    await load();
  };

  const openIncomingCall = (request: PartnerIncomingRequest) => {
    if (request.type !== "AUDIO" && request.type !== "VIDEO") return;
    rootNavigation.navigate("IncomingCall", {
      requestId: request.id,
      kind: request.type,
      callerName: getRequestMemberLabel(request),
    });
  };

  const joinSession = (session: PartnerActiveSession) => {
    if (session.type === "CHAT") rootNavigation.navigate("ChatThread", { sessionId: session.id });
    else rootNavigation.navigate("Call", { sessionId: session.id, kind: session.type });
  };

  return (
    <View style={sharedStyles.screen}>
      <ScreenHeader title="Overview" />
      <ScrollView
        contentContainerStyle={sharedStyles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        {loading ? <LoadingState label="Loading host dashboard..." /> : null}
        <AppCard style={styles.hero}>
          <View style={styles.heroTop}>
            <Avatar uri={profileImageUrl} name={hostName} size={58} />
            <View style={styles.heroIdentity}>
              <Text style={styles.welcome} numberOfLines={2} ellipsizeMode="tail">Welcome, {hostName}</Text>
              <Text style={styles.subcopy}>Your partner workspace for safe, respectful conversations.</Text>
            </View>
            <StatusChip label={status === "ONLINE" ? "Online" : status === "BUSY" ? "Busy" : "Offline"} tone={statusTone(status)} />
          </View>
          <View style={styles.chips}>
            <StatusChip label={labels.kyc} tone={labels.kyc.includes("VERIFIED") ? "green" : "amber"} />
            <StatusChip label={labels.review} tone={approved ? "green" : "amber"} />
            <StatusChip label={status === "ONLINE" ? "Online" : status === "BUSY" ? "Busy" : "Offline"} tone={statusTone(status)} />
          </View>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {fcm.message ? <Text style={styles.message}>{fcm.message}</Text> : null}
          {isDebugBuild() ? (
            <Text style={styles.debugText}>
              Dashboard: {String(dashboard?.companionStatus ?? "-")} / {String(dashboard?.applicationStatus ?? "-")} | uid present {String(debugIdentity.firebaseUidPresent ?? "-")} | phone matched {String(debugIdentity.phoneMatched ?? "-")}
            </Text>
          ) : null}
          <View style={styles.availabilityBlock}>
            <AppButton
              title={updating ? "Updating…" : online ? "Go Offline" : "Go Online"}
              onPress={() => void toggleAvailability()}
              loading={updating}
              disabled={!approved || updating || status === "BUSY"}
            />
            {updating ? <Text style={styles.message}>Updating availability...</Text> : null}
          </View>
        </AppCard>

        <View style={styles.quickActions}>
          <Pressable style={styles.quickAction} onPress={() => rootNavigation.navigate("Onboarding")}>
            <FileCheck2 size={18} color={colors.primary} />
            <Text style={styles.quickText}>KYC</Text>
          </Pressable>
          <Pressable style={styles.quickAction} onPress={() => navigation.navigate("Requests")}>
            <BellRing size={18} color={colors.primary} />
            <Text style={styles.quickText}>Requests</Text>
          </Pressable>
          <Pressable style={styles.quickAction} onPress={() => navigation.navigate("Chats")}>
            <MessageCircle size={18} color={colors.primary} />
            <Text style={styles.quickText}>Chats</Text>
          </Pressable>
          <Pressable style={styles.quickAction} onPress={() => rootNavigation.navigate("Settings")}>
            <Settings size={18} color={colors.primary} />
            <Text style={styles.quickText}>Settings</Text>
          </Pressable>
        </View>

        <View style={styles.metrics}>
          <MetricCard label="People supported today" value={stats.peopleSupportedToday ?? 0} />
          <MetricCard label="Audio conversations" value={stats.audioConversations ?? 0} />
          <MetricCard label="Video conversations" value={stats.videoConversations ?? 0} />
          <MetricCard label="Pending requests" value={stats.pendingRequests ?? pending.length} />
          <MetricCard label="Today's earnings" value={formatINR(stats.earningsToday)} />
          <MetricCard label="Average rating" value={stats.averageRating ? Number(stats.averageRating).toFixed(1) : "Not rated yet"} />
        </View>

        <AppCard style={styles.section}>
          <SectionHeader title="People waiting to talk" caption="Incoming chat, audio, and video requests appear here." />
          {pending.length === 0 ? <EmptyState title="No new requests" message="Stay online to receive new member requests." /> : null}
          {pending.map((request) => (
              <View key={request.id} style={styles.listItem}>
              <View style={styles.typeIcon}>
                {request.type === "VIDEO" ? <Video size={17} color={colors.primary} /> : request.type === "AUDIO" ? <Phone size={17} color={colors.primary} /> : <MessageCircle size={17} color={colors.primary} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{maskPhone(getRequestMemberLabel(request))}</Text>
                <Text style={styles.itemMeta}>{request.type} - {formatINR(request.expectedRate)}</Text>
              </View>
              {request.type === "CHAT" ? (
                <>
                  <AppButton title="Accept" onPress={() => void handleAccept(request)} style={styles.smallButton} />
                  <Pressable onPress={() => void handleDecline(request)} style={styles.decline}><Text style={styles.declineText}>Decline</Text></Pressable>
                </>
              ) : (
                <AppButton title="View call" onPress={() => openIncomingCall(request)} style={styles.callButton} />
              )}
            </View>
          ))}
        </AppCard>

        <AppCard style={styles.section}>
          <SectionHeader title="Ongoing conversations" />
          {active.length === 0 ? <Text style={styles.empty}>No ongoing conversations.</Text> : null}
          {active.map((session) => (
            <View key={session.id} style={styles.listItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{maskPhone(session.memberPhoneMasked || session.memberLabel)}</Text>
                <Text style={styles.itemMeta}>{session.type} - {session.status || "LIVE"}</Text>
              </View>
              <Pressable onPress={() => joinSession(session)} style={styles.join}><Text style={styles.joinText}>Join</Text></Pressable>
              <Pressable onPress={() => void endSession(session.id).then(load)} style={styles.decline}><Text style={styles.declineText}>End</Text></Pressable>
            </View>
          ))}
        </AppCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: 14 },
  heroTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  heroIdentity: { flex: 1, minWidth: 0 },
  welcome: { color: colors.text, fontSize: 22, fontWeight: "900", lineHeight: 28, flexShrink: 1 },
  subcopy: { color: colors.textMuted, marginTop: 6, lineHeight: 21 },
  chips: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 14 },
  message: { color: colors.textMuted, marginTop: 10, fontSize: 12, lineHeight: 18 },
  debugText: { color: colors.textMuted, marginTop: 10, fontSize: 11, lineHeight: 16 },
  availabilityBlock: { marginTop: 16, gap: 8 },
  quickActions: { flexDirection: "row", gap: 8, marginBottom: 14 },
  quickAction: { flex: 1, minHeight: 70, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", gap: 7 },
  quickText: { color: colors.text, fontSize: 12, fontWeight: "900" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  section: { marginBottom: 14 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "900", marginBottom: 10 },
  empty: { color: colors.textMuted, lineHeight: 21 },
  listItem: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 10 },
  typeIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  itemTitle: { color: colors.text, fontWeight: "800", fontSize: 14 },
  itemMeta: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  smallButton: { minHeight: 38, paddingHorizontal: 12 },
  callButton: { minHeight: 42, paddingHorizontal: 15 },
  join: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12 },
  joinText: { color: colors.text, fontWeight: "800" },
  decline: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: 12, backgroundColor: colors.dangerSoft },
  declineText: { color: colors.danger, fontWeight: "800", fontSize: 12 },
});
