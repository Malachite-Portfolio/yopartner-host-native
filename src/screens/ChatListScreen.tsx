import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { getMySessions } from "../api/sessions";
import { AppCard } from "../components/AppCard";
import { Avatar } from "../components/Avatar";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { ScreenHeader } from "../components/ScreenHeader";
import { StatusChip } from "../components/StatusChip";
import { useInterval } from "../hooks/useInterval";
import type { RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { sharedStyles } from "../theme/styles";
import type { SessionRecord } from "../types/api";
import { maskPhone } from "../utils/format";
import { getSessionMemberLabel } from "../utils/partner";

type RootNav = NativeStackNavigationProp<RootStackParamList>;

function isOngoingChat(session: SessionRecord) {
  return ["LIVE", "ACTIVE", "ONGOING", "ACCEPTED", "IN_PROGRESS"].includes(String(session.status ?? "").toUpperCase());
}

export function ChatListScreen() {
  const navigation = useNavigation<RootNav>();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const response = await getMySessions();
    if (response.data) {
      setSessions(response.data.sessions.filter((session) => session.serviceType === "CHAT" || session.type === "CHAT"));
      setError("");
    } else if (response.error) {
      setError(response.error.message);
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

  useInterval(() => {
    void load();
  }, 6000);

  const visibleSessions = sessions.filter((session) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return [
      getSessionMemberLabel(session),
      session.status,
      session.sessionCode,
      session.lastMessage,
    ].some((value) => String(value ?? "").toLowerCase().includes(needle));
  }).sort((left, right) => {
    const ongoingOrder = Number(isOngoingChat(right)) - Number(isOngoingChat(left));
    if (ongoingOrder) return ongoingOrder;
    return new Date(right.updatedAt ?? right.createdAt ?? 0).getTime() - new Date(left.updatedAt ?? left.createdAt ?? 0).getTime();
  });

  return (
    <View style={sharedStyles.screen}>
      <ScreenHeader title="Conversations" />
      <ScrollView
        contentContainerStyle={sharedStyles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        {loading ? <LoadingState label="Loading conversations..." /> : null}
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
        <View style={styles.searchWrap}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by member or status..."
            placeholderTextColor={colors.textSoft}
            style={styles.searchInput}
          />
        </View>
        {visibleSessions.length === 0 && !loading ? (
          <AppCard>
            <EmptyState title="No ongoing conversations." message="Accepted chat requests will appear here with latest message context." />
          </AppCard>
        ) : null}
        {visibleSessions.map((session) => (
          <Pressable key={session.id} style={styles.item} onPress={() => navigation.navigate("ChatThread", { sessionId: session.id })}>
            <Avatar name={getSessionMemberLabel(session)} size={48} />
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={1}>{maskPhone(getSessionMemberLabel(session))}</Text>
                <Text style={styles.time}>{session.updatedAt ? new Date(session.updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : ""}</Text>
              </View>
              <Text style={styles.meta} numberOfLines={1}>{session.lastMessage || session.sessionCode || "Private session"}</Text>
            </View>
            {session.unreadCount ? <View style={styles.unread}><Text style={styles.unreadText}>{session.unreadCount}</Text></View> : null}
            <StatusChip label={isOngoingChat(session) ? "Ongoing" : session.status || "Pending"} tone={isOngoingChat(session) ? "green" : "slate"} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  searchWrap: { marginBottom: 12 },
  searchInput: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: "700",
  },
  item: { marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 14 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { color: colors.text, fontSize: 16, fontWeight: "900" },
  meta: { color: colors.textMuted, marginTop: 4, fontSize: 12 },
  time: { color: colors.textSoft, fontSize: 11, fontWeight: "800" },
  unread: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  unreadText: { color: colors.white, fontSize: 11, fontWeight: "900" },
  empty: { color: colors.textMuted, textAlign: "center", marginTop: 40 },
  error: { color: colors.danger, marginBottom: 12 },
});
