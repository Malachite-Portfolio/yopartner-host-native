import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft, PhoneOff, Send } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { endSession, getSessionById, getSessionMessages, sendSessionMessage } from "../api/sessions";
import { Avatar } from "../components/Avatar";
import { EmptyState } from "../components/EmptyState";
import { useInterval } from "../hooks/useInterval";
import type { RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import type { SessionMessage, SessionRecord } from "../types/api";
import { maskPhone } from "../utils/format";
import { getSessionMemberLabel } from "../utils/partner";

type Props = NativeStackScreenProps<RootStackParamList, "ChatThread">;

export function ChatThreadScreen({ route, navigation }: Props) {
  const { sessionId } = route.params;
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [sessionResponse, messagesResponse] = await Promise.all([getSessionById(sessionId), getSessionMessages(sessionId)]);
    if (sessionResponse.data) setSession(sessionResponse.data.session);
    if (messagesResponse.data) setMessages(messagesResponse.data.messages);
    if (sessionResponse.error) setError(sessionResponse.error.message);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  useInterval(() => {
    void load();
  }, session?.status === "LIVE" ? 2500 : null);

  const send = async () => {
    const body = input.trim();
    if (!body || session?.status !== "LIVE") return;
    const clientMessageId = `rn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setInput("");
    const optimistic: SessionMessage = {
      id: clientMessageId,
      sessionId,
      senderRole: "PARTNER",
      body,
      text: body,
      createdAt: new Date().toISOString(),
      isMine: true,
    };
    setMessages((current) => [...current, optimistic]);
    const response = await sendSessionMessage(sessionId, body, clientMessageId);
    if (response.error) {
      setError(response.error.message);
      setMessages((current) => current.filter((message) => message.id !== clientMessageId));
    } else if (response.data?.message) {
      setMessages((current) => [...current.filter((message) => message.id !== clientMessageId), response.data!.message]);
    }
  };

  const title = maskPhone(session?.user?.phoneMasked || session?.user?.phoneNumber || session?.user?.name || "Member");
  const memberName = session ? getSessionMemberLabel(session) : "Member";

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.header}>
          <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={20} color={colors.text} />
          </Pressable>
          <Avatar name={memberName} size={42} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.meta}>{session?.status === "LIVE" ? "Live chat" : session?.status || "Opening conversation"}</Text>
          </View>
          <Pressable style={styles.endButton} onPress={() => void endSession(sessionId).then(() => navigation.goBack())}>
            <PhoneOff size={17} color={colors.white} />
            <Text style={styles.endText}>End</Text>
          </Pressable>
        </View>
      </SafeAreaView>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} /> : null}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messages}
        ListEmptyComponent={!loading ? <EmptyState title="No messages yet" message="Messages will appear here after the session starts." /> : null}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.isMine ? styles.mine : styles.theirs]}>
            <Text style={[styles.messageText, item.isMine && styles.mineText]}>{item.text || item.body}</Text>
            <Text style={[styles.time, item.isMine && styles.mineTime]}>{new Date(item.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</Text>
          </View>
        )}
      />
      <View style={styles.composer}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={session?.status === "LIVE" ? "Type a message" : "Session ended"}
          placeholderTextColor={colors.textSoft}
          editable={session?.status === "LIVE"}
          style={styles.input}
          multiline
        />
        <Pressable style={[styles.send, (!input.trim() || session?.status !== "LIVE") && styles.sendDisabled]} onPress={() => void send()}>
          <Send size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceMuted },
  safeArea: { backgroundColor: colors.background },
  header: { minHeight: 74, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  iconButton: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  title: { color: colors.text, fontWeight: "900", fontSize: 17 },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  endButton: { minHeight: 40, borderRadius: 18, paddingHorizontal: 12, backgroundColor: colors.danger, flexDirection: "row", alignItems: "center", gap: 6 },
  endText: { color: colors.white, fontWeight: "900" },
  error: { color: colors.danger, padding: 10, textAlign: "center" },
  messages: { padding: 14, gap: 9 },
  bubble: { maxWidth: "82%", borderRadius: 18, paddingHorizontal: 13, paddingVertical: 10 },
  mine: { alignSelf: "flex-end", backgroundColor: colors.primary },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  messageText: { color: colors.text, fontSize: 15, lineHeight: 21 },
  mineText: { color: "#fff" },
  time: { marginTop: 5, color: colors.textMuted, fontSize: 10 },
  mineTime: { color: "rgba(255,255,255,0.72)" },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 10, padding: 12, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
  input: { flex: 1, minHeight: 46, maxHeight: 120, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14, paddingTop: 12, color: colors.text },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  sendDisabled: { opacity: 0.45 },
});
