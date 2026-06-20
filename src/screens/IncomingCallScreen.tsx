import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Mic, PhoneCall, PhoneOff, Video } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, Vibration, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { acceptPartnerRequest, declinePartnerRequest, getPartnerDashboard } from "../api/partner";
import { Avatar } from "../components/Avatar";
import { startCallRingtone, stopCallRingtone } from "../native/callRingtone";
import type { RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { maskPhone } from "../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "IncomingCall">;

export function IncomingCallScreen({ route, navigation }: Props) {
  const { requestId, kind, callerName } = route.params;
  const [action, setAction] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState("");
  const [callAvailable, setCallAvailable] = useState(true);
  const displayName = maskPhone(callerName || "Member");
  const isVideo = kind === "VIDEO";

  useEffect(() => {
    let mounted = true;
    let checking = false;
    let terminal = false;
    startCallRingtone();
    Vibration.vibrate([0, 700, 350, 700], true);
    const checkAvailability = async () => {
      if (!mounted || checking || terminal) return;
      checking = true;
      try {
        const response = await getPartnerDashboard();
        if (!mounted || !response.data) return;
        const pending = (response.data.pendingRequests ?? []).some((request) => request.id === requestId);
        const active = (response.data.activeSessions ?? []).some((session) => session.id === requestId);
        if (active) {
          terminal = true;
          stopCallRingtone();
          Vibration.cancel();
          navigation.replace("Call", { sessionId: requestId, kind });
          return;
        }
        if (!pending) {
          terminal = true;
          stopCallRingtone();
          Vibration.cancel();
          setCallAvailable(false);
          setError("This call is no longer active.");
        }
      } finally {
        checking = false;
      }
    };
    void checkAvailability();
    const availabilityTimer = setInterval(() => void checkAvailability(), 4000);
    return () => {
      mounted = false;
      clearInterval(availabilityTimer);
      stopCallRingtone();
      Vibration.cancel();
    };
  }, [kind, navigation, requestId]);

  const accept = async () => {
    stopCallRingtone();
    Vibration.cancel();
    setAction("accept");
    setError("");
    const response = await acceptPartnerRequest(requestId);
    if (response.error) {
      setError(response.error.message);
      setAction(null);
      return;
    }
    navigation.replace("Call", { sessionId: requestId, kind });
  };

  const decline = async () => {
    stopCallRingtone();
    Vibration.cancel();
    setAction("decline");
    setError("");
    const response = await declinePartnerRequest(requestId);
    if (response.error) {
      setError(response.error.message);
      setAction(null);
      return;
    }
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace("MainTabs");
  };

  return (
    <View style={styles.screen}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="incomingCallBackground" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#062925" />
            <Stop offset="0.55" stopColor="#0f766e" />
            <Stop offset="1" stopColor="#071716" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#incomingCallBackground)" />
      </Svg>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}><PhoneCall size={18} color="#ccfbf1" /></View>
          <Text style={styles.brand}>YoPartner Host</Text>
        </View>

        <View style={styles.callerArea}>
          <Text style={styles.status}>Incoming call</Text>
          <View style={styles.avatarRing}>
            <Avatar name={displayName} size={132} />
            <View style={styles.callTypeBadge}>
              {isVideo ? <Video size={22} color={colors.white} /> : <Mic size={22} color={colors.white} />}
            </View>
          </View>
          <Text style={styles.callerName} numberOfLines={2}>{displayName}</Text>
          <Text style={styles.callType}>{isVideo ? "Video call" : "Audio call"}</Text>
          <Text style={styles.secureCopy}>Safe, private conversation through YoPartner</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={styles.actions}>
          <View style={styles.actionItem}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Decline incoming call"
              disabled={Boolean(action) || !callAvailable}
              onPress={() => void decline()}
              style={[styles.actionButton, styles.declineButton, action && styles.disabled]}
            >
              {action === "decline" ? <ActivityIndicator color={colors.white} /> : <PhoneOff size={31} color={colors.white} />}
            </Pressable>
            <Text style={styles.actionLabel}>Decline</Text>
          </View>
          <View style={styles.actionItem}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Accept incoming call"
              disabled={Boolean(action) || !callAvailable}
              onPress={() => void accept()}
              style={[styles.actionButton, styles.acceptButton, action && styles.disabled]}
            >
              {action === "accept" ? <ActivityIndicator color={colors.white} /> : isVideo ? <Video size={31} color={colors.white} /> : <PhoneCall size={31} color={colors.white} />}
            </Pressable>
            <Text style={styles.actionLabel}>Accept</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#071716", overflow: "hidden" },
  safeArea: { flex: 1, paddingHorizontal: 24, paddingVertical: 12 },
  glowTop: { position: "absolute", width: 280, height: 280, borderRadius: 140, backgroundColor: "rgba(45,212,191,0.14)", top: -110, right: -95 },
  glowBottom: { position: "absolute", width: 320, height: 320, borderRadius: 160, backgroundColor: "rgba(255,255,255,0.06)", bottom: -190, left: -130 },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingTop: 8 },
  brandMark: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  brand: { color: "#ccfbf1", fontSize: 15, fontWeight: "900", letterSpacing: 0.4 },
  callerArea: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 16 },
  status: { color: "#99f6e4", fontSize: 15, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.8, marginBottom: 28 },
  avatarRing: { width: 158, height: 158, borderRadius: 79, borderWidth: 2, borderColor: "rgba(204,251,241,0.48)", backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.34, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 12 },
  callTypeBadge: { position: "absolute", right: 1, bottom: 8, width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primaryDark, borderWidth: 3, borderColor: "#0b4b45", alignItems: "center", justifyContent: "center" },
  callerName: { color: colors.white, textAlign: "center", fontSize: 31, lineHeight: 38, fontWeight: "900", marginTop: 28, maxWidth: "90%" },
  callType: { color: "#ccfbf1", fontSize: 18, fontWeight: "800", marginTop: 8 },
  secureCopy: { color: "rgba(255,255,255,0.68)", textAlign: "center", fontSize: 13, lineHeight: 19, marginTop: 11 },
  error: { color: "#fecdd3", textAlign: "center", marginTop: 16, fontWeight: "700" },
  actions: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingHorizontal: 18, paddingBottom: 22 },
  actionItem: { alignItems: "center", gap: 10 },
  actionButton: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  declineButton: { backgroundColor: colors.danger },
  acceptButton: { backgroundColor: "#16a34a" },
  disabled: { opacity: 0.58 },
  actionLabel: { color: colors.white, fontSize: 15, fontWeight: "900" },
});
