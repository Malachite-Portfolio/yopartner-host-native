import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft, Camera, CameraOff, Check, Lock, Mic, MicOff, PhoneOff, RefreshCw, ShieldCheck, Volume2, VolumeX } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { createAgoraRtcEngine, ChannelProfileType, ClientRoleType, RtcSurfaceView } from "react-native-agora";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { endSession, getSessionAgoraToken, getSessionById, markSessionMediaReady } from "../api/sessions";
import type { RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { cardShadow } from "../theme/styles";
import { formatClock } from "../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "Call">;

async function requestCallPermissions(video: boolean) {
  if (Platform.OS !== "android") return;
  const permissions = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  if (video) permissions.push(PermissionsAndroid.PERMISSIONS.CAMERA);
  const results = await PermissionsAndroid.requestMultiple(permissions);
  const denied = permissions.some((permission) => results[permission] !== PermissionsAndroid.RESULTS.GRANTED);
  if (denied) throw new Error("Microphone and camera permissions are required to join the call.");
}

function parseAgoraUid(value: number | string) {
  const uid = typeof value === "number" ? value : Number(value.trim());
  if (!Number.isInteger(uid) || uid < 0 || uid > 0xffffffff) {
    throw new Error("The call connection details are invalid. Please retry.");
  }
  return uid;
}

function parseTimestamp(value?: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function sessionStartTimestamp(session: {
  liveStartedAt?: string | null;
  startedAt?: string | null;
  acceptedAt?: string | null;
}) {
  return (
    parseTimestamp(session.liveStartedAt) ??
    parseTimestamp(session.startedAt) ??
    parseTimestamp(session.acceptedAt)
  );
}

export function CallScreen({ route, navigation }: Props) {
  const { sessionId, kind } = route.params;
  const video = kind === "VIDEO";
  const insets = useSafeAreaInsets();
  const [joining, setJoining] = useState(true);
  const [joined, setJoined] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [partnerName, setPartnerName] = useState("YoPartner");
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [cameraOff, setCameraOff] = useState(false);
  const joinedRef = useRef(false);
  const localTimerStartRef = useRef(Date.now());
  const timerBaseRef = useRef(localTimerStartRef.current);

  const engine = useMemo(() => createAgoraRtcEngine(), []);

  const leave = useCallback(async () => {
    try {
      engine.leaveChannel();
      engine.release();
    } catch {
      // Ignore native cleanup errors during navigation teardown.
    }
    await endSession(sessionId);
    navigation.goBack();
  }, [engine, navigation, sessionId]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    try {
      engine.muteLocalAudioStream(next);
    } catch {
      setError("Could not update microphone state.");
    }
  };

  const toggleSpeaker = () => {
    const next = !speaker;
    setSpeaker(next);
    try {
      engine.setEnableSpeakerphone(next);
    } catch {
      setError("Could not update speaker state.");
    }
  };

  const toggleCamera = () => {
    if (!video) return;
    const next = !cameraOff;
    setCameraOff(next);
    try {
      engine.muteLocalVideoStream(next);
    } catch {
      setError("Could not update camera state.");
    }
  };

  const switchCamera = () => {
    if (!video) return;
    try {
      engine.switchCamera();
    } catch {
      setError("Could not switch camera.");
    }
  };

  useEffect(() => {
    const updateTimer = () => {
      setSeconds(Math.max(0, Math.floor((Date.now() - timerBaseRef.current) / 1000)));
    };
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        await requestCallPermissions(video);
        console.log("[agora] join attempt", {
          sessionId,
          tokenEndpoint: `/api/sessions/${sessionId}/agora-token`,
          kind,
        });
        const [tokenResponse, sessionResponse] = await Promise.all([
          getSessionAgoraToken(sessionId),
          getSessionById(sessionId),
        ]);
        if (!tokenResponse.data) throw new Error(tokenResponse.error?.message || "Could not get Agora token.");
        const token = tokenResponse.data;
        const channelName = String(token.channelName ?? "").trim();
        const uid = parseAgoraUid(token.uid);
        if (!token.appId?.trim() || !token.token?.trim() || !channelName) {
          throw new Error("The call connection details are incomplete. Please retry.");
        }

        const session = sessionResponse.data?.session;
        if (session) {
          const startedAt = sessionStartTimestamp(session);
          if (startedAt) timerBaseRef.current = Math.min(startedAt, Date.now());
          const name = session.user?.name?.trim() || session.user?.fullName?.trim();
          if (mounted && name) setPartnerName(name);
          console.log("[call] session metadata", {
            sessionId,
            timerSource: session.liveStartedAt
              ? "liveStartedAt"
              : session.startedAt
                ? "startedAt"
                : session.acceptedAt
                  ? "acceptedAt"
                  : "local",
            partnerNamePresent: Boolean(name),
          });
        } else {
          console.warn("[call] session metadata unavailable", {
            sessionId,
            status: sessionResponse.status,
            message: sessionResponse.error?.message,
          });
        }

        console.log("[agora] credentials ready", {
          sessionId,
          channelName,
          uid,
          tokenEndpoint: `/api/sessions/${sessionId}/agora-token`,
        });
        const initializeResult = engine.initialize({
          appId: token.appId,
          channelProfile: ChannelProfileType.ChannelProfileCommunication,
        });
        if (initializeResult < 0) {
          throw new Error(`Agora initialization failed (${initializeResult}).`);
        }
        engine.registerEventHandler({
          onJoinChannelSuccess: (connection) => {
            if (!mounted) return;
            joinedRef.current = true;
            setJoined(true);
            setJoining(false);
            setError("");
            engine.setEnableSpeakerphone(true);
            console.log("[agora] join success", {
              sessionId,
              channelName: connection.channelId || channelName,
              uid: connection.localUid || uid,
            });
            void markSessionMediaReady(sessionId);
          },
          onUserJoined: (_connection, uid) => {
            if (mounted) setRemoteUid(uid);
          },
          onUserOffline: () => {
            if (mounted) setRemoteUid(null);
          },
          onError: (err, msg) => {
            console.warn("[agora] SDK error", {
              code: err,
              message: msg || null,
              sessionId,
              channelName,
              uid,
              joinAttemptState: joinedRef.current ? "joined" : "joining",
            });
            if (mounted && !joinedRef.current) {
              setJoining(false);
              setError("Unable to join call. Please retry.");
            }
          },
        });
        if (video) engine.enableVideo();
        const joinResult = engine.joinChannel(String(token.token), channelName, uid, {
          clientRoleType: ClientRoleType.ClientRoleBroadcaster,
          publishMicrophoneTrack: true,
          publishCameraTrack: video,
          autoSubscribeAudio: true,
          autoSubscribeVideo: video,
        });
        console.log("[agora] join submitted", {
          sessionId,
          channelName,
          uid,
          result: joinResult,
        });
        if (joinResult < 0) {
          throw new Error(`Agora join request failed (${joinResult}).`);
        }
      } catch (callError) {
        const message = callError instanceof Error ? callError.message : "Unable to join call.";
        console.warn("[agora] join failed", {
          sessionId,
          tokenEndpoint: `/api/sessions/${sessionId}/agora-token`,
          joinAttemptState: joinedRef.current ? "joined" : "joining",
          message,
        });
        if (mounted) {
          setJoining(false);
          setError(
            message.startsWith("Microphone") || message.startsWith("The call connection")
              ? message
              : "Call connection failed. Please retry.",
          );
        }
      }
    })();
    return () => {
      mounted = false;
      joinedRef.current = false;
      try {
        engine.leaveChannel();
        engine.release();
      } catch {
        // Ignore cleanup errors.
      }
    };
  }, [engine, kind, sessionId, video]);

  const callStatus = joining ? "Joining securely..." : joined ? "Audio connected" : "Ready";
  const memberStatus = remoteUid ? "Member is connected." : "Waiting for member to join the session.";
  const videoCallStatus = joining ? "Joining securely..." : remoteUid ? "Video connected" : joined ? "Waiting for video..." : "Ready";

  if (!video) {
    return (
      <View style={styles.audioScreen}>
        <View style={[styles.audioTopbar, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" style={styles.audioBackButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={20} color={colors.text} />
          </Pressable>
          <View style={styles.securePill}>
            <Text style={styles.securePillText}>YOPARTNER SECURE CALL</Text>
          </View>
          <View style={styles.secureBadge}>
            <Lock size={13} color={colors.primary} />
            <Text style={styles.secureBadgeText}>Secure</Text>
          </View>
        </View>

        <View style={styles.audioContent}>
          <Text style={styles.audioEyebrow}>AUDIO CALL</Text>
          <View style={styles.audioNameRow}>
            <Text style={styles.audioName} numberOfLines={1}>{partnerName}</Text>
            <View style={styles.nameVerifiedBadge}>
              <Check size={13} color={colors.white} strokeWidth={3} />
            </View>
          </View>
          <Text style={styles.audioStatus}>{callStatus}</Text>
          <Text style={styles.audioTimer}>{formatClock(seconds)}</Text>

          <View style={styles.trustVisualWrap}>
            <View style={styles.trustGlowOuter}>
              <View style={styles.trustGlowMiddle}>
                <View style={styles.trustCircle}>
                  <ShieldCheck size={62} color={colors.primary} strokeWidth={1.8} />
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.audioConnectionCopy}>{memberStatus}</Text>
          {joining ? <ActivityIndicator color={colors.primary} style={styles.audioSpinner} /> : null}
          {error ? <Text style={styles.audioError}>{error}</Text> : null}
        </View>

        <View style={[styles.audioControlsWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.audioControlsCard}>
            <Pressable accessibilityRole="button" accessibilityLabel={muted ? "Unmute microphone" : "Mute microphone"} style={[styles.audioControlButton, muted && styles.audioControlButtonActive]} onPress={toggleMute}>
              {muted ? <MicOff size={22} color={colors.primary} /> : <Mic size={22} color={colors.primary} />}
              <Text style={styles.audioControlLabel}>{muted ? "Unmute" : "Mic"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={speaker ? "Turn speaker off" : "Turn speaker on"} style={[styles.audioControlButton, speaker && styles.audioControlButtonActive]} onPress={toggleSpeaker}>
              {speaker ? <Volume2 size={22} color={colors.primary} /> : <VolumeX size={22} color={colors.primary} />}
              <Text style={styles.audioControlLabel}>{speaker ? "Speaker On" : "Speaker Off"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="End call" style={styles.audioEndButton} onPress={() => void leave()}>
              <PhoneOff size={30} color={colors.white} />
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.videoScreen}>
      <View style={styles.videoStage}>
        {remoteUid ? (
          <RtcSurfaceView canvas={{ uid: remoteUid }} style={styles.videoRemoteSurface} />
        ) : (
          <View style={styles.videoWaitingStage}>
            <View style={styles.videoWaitingCard}>
              <View style={styles.videoVerifiedIcon}>
                <ShieldCheck size={46} color={colors.primary} />
              </View>
              <Text style={styles.videoWaitingTitle}>{joining ? "Joining secure video..." : "Waiting for video..."}</Text>
              <Text style={styles.videoWaitingCopy}>Your YoPartner video session will appear here as soon as the member connects.</Text>
              {joining ? <ActivityIndicator color={colors.primary} style={{ marginTop: 14 }} /> : null}
            </View>
          </View>
        )}

        <View style={[styles.videoHeader, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" style={styles.videoBackButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={20} color={colors.text} />
          </Pressable>
          <View style={styles.videoSecurePill}>
            <Text style={styles.videoSecurePillText}>YOPARTNER SECURE CALL</Text>
          </View>
          <View style={styles.videoSecureBadge}>
            <Lock size={13} color={colors.primary} />
            <Text style={styles.videoSecureBadgeText}>Secure</Text>
          </View>
        </View>

        <View style={[styles.videoInfoCard, { top: Math.max(insets.top, 12) + 64 }]}>
          <Text style={styles.videoEyebrow}>VIDEO CALL</Text>
          <View style={styles.videoNameRow}>
            <Text style={styles.videoName} numberOfLines={1}>{partnerName}</Text>
            <View style={styles.videoNameBadge}>
              <Check size={12} color={colors.white} strokeWidth={3} />
            </View>
          </View>
          <Text style={styles.videoStatus}>{videoCallStatus} · {formatClock(seconds)}</Text>
        </View>

        <View style={styles.localVideoWrap}>
          {!cameraOff ? (
            <RtcSurfaceView canvas={{ uid: 0 }} style={styles.videoLocalSurface} />
          ) : (
            <View style={styles.videoLocalOff}>
              <CameraOff size={24} color={colors.primary} />
              <Text style={styles.videoLocalOffText}>Camera Off</Text>
            </View>
          )}
        </View>

        {error ? <Text style={styles.videoError}>{error}</Text> : null}
      </View>

      <View style={[styles.videoControlsWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.videoControlsCard}>
          <Pressable accessibilityRole="button" accessibilityLabel={muted ? "Unmute microphone" : "Mute microphone"} style={[styles.videoControlButton, muted && styles.videoControlActive]} onPress={toggleMute}>
            {muted ? <MicOff size={21} color={colors.primary} /> : <Mic size={21} color={colors.primary} />}
            <Text style={styles.videoControlLabel}>{muted ? "Unmute" : "Mic"}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={speaker ? "Turn speaker off" : "Turn speaker on"} style={[styles.videoControlButton, speaker && styles.videoControlActive]} onPress={toggleSpeaker}>
            {speaker ? <Volume2 size={21} color={colors.primary} /> : <VolumeX size={21} color={colors.primary} />}
            <Text style={styles.videoControlLabel}>{speaker ? "Speaker" : "Earpiece"}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={cameraOff ? "Turn camera on" : "Turn camera off"} style={[styles.videoControlButton, cameraOff && styles.videoControlActive]} onPress={toggleCamera}>
            {cameraOff ? <CameraOff size={21} color={colors.primary} /> : <Camera size={21} color={colors.primary} />}
            <Text style={styles.videoControlLabel}>{cameraOff ? "Camera" : "Hide"}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Switch camera" style={styles.videoControlButton} onPress={switchCamera}>
            <RefreshCw size={21} color={colors.primary} />
            <Text style={styles.videoControlLabel}>Flip</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="End call" style={styles.videoEndButton} onPress={() => void leave()}>
            <PhoneOff size={28} color={colors.white} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  audioScreen: { flex: 1, backgroundColor: colors.tealMist },
  audioTopbar: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  audioBackButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
  securePill: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  securePillText: { color: colors.primaryDark, fontSize: 11, fontWeight: "900", letterSpacing: 1.1, textAlign: "center" },
  secureBadge: {
    minHeight: 38,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 10,
  },
  secureBadgeText: { color: colors.primaryDark, fontSize: 11, fontWeight: "900" },
  audioContent: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingBottom: 8 },
  audioEyebrow: { color: colors.primary, fontSize: 12, fontWeight: "900", letterSpacing: 1.7 },
  audioNameRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10, maxWidth: "100%" },
  audioName: { color: colors.text, fontSize: 30, lineHeight: 36, fontWeight: "900", maxWidth: "86%" },
  nameVerifiedBadge: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  audioStatus: { color: colors.textMuted, fontSize: 15, fontWeight: "800", marginTop: 8 },
  audioTimer: { color: colors.text, fontSize: 46, lineHeight: 56, fontWeight: "900", letterSpacing: 1.1, marginTop: 10 },
  trustVisualWrap: { width: 232, height: 232, alignItems: "center", justifyContent: "center", marginTop: 26 },
  trustGlowOuter: { width: 232, height: 232, borderRadius: 116, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15,118,110,0.08)" },
  trustGlowMiddle: { width: 178, height: 178, borderRadius: 89, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15,118,110,0.12)" },
  trustCircle: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
  audioConnectionCopy: { color: colors.textMuted, textAlign: "center", lineHeight: 21, marginTop: 18, fontWeight: "700" },
  audioSpinner: { marginTop: 14 },
  audioError: { color: colors.danger, textAlign: "center", paddingHorizontal: 18, marginTop: 14, fontWeight: "800", lineHeight: 20 },
  audioControlsWrap: { paddingHorizontal: 16, paddingTop: 8 },
  audioControlsCard: {
    minHeight: 92,
    borderRadius: 32,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...cardShadow,
  },
  audioControlButton: {
    flex: 1,
    minHeight: 64,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  audioControlButtonActive: { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong },
  audioControlLabel: { color: colors.text, fontSize: 11, fontWeight: "900", textAlign: "center" },
  audioEndButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.danger,
    ...cardShadow,
  },
  videoScreen: { flex: 1, backgroundColor: colors.tealMist },
  videoStage: { flex: 1, backgroundColor: "#061817", overflow: "hidden" },
  videoRemoteSurface: { flex: 1 },
  videoWaitingStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.tealMist,
    paddingHorizontal: 24,
  },
  videoWaitingCard: {
    width: "100%",
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 22,
    alignItems: "center",
    ...cardShadow,
  },
  videoVerifiedIcon: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
    marginBottom: 16,
  },
  videoWaitingTitle: { color: colors.text, fontSize: 22, fontWeight: "900", textAlign: "center" },
  videoWaitingCopy: { color: colors.textMuted, fontSize: 13, lineHeight: 20, fontWeight: "700", textAlign: "center", marginTop: 8 },
  videoHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 6,
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  videoBackButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: "rgba(220,234,229,0.9)",
  },
  videoSecurePill: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: "rgba(220,234,229,0.9)",
    paddingHorizontal: 10,
  },
  videoSecurePillText: { color: colors.primaryDark, fontSize: 10, fontWeight: "900", letterSpacing: 1, textAlign: "center" },
  videoSecureBadge: {
    minHeight: 38,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "rgba(232,247,242,0.96)",
    borderWidth: 1,
    borderColor: "rgba(184,214,205,0.95)",
    paddingHorizontal: 10,
  },
  videoSecureBadgeText: { color: colors.primaryDark, fontSize: 11, fontWeight: "900" },
  videoInfoCard: {
    position: "absolute",
    left: 16,
    right: 132,
    zIndex: 5,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "rgba(220,234,229,0.9)",
    padding: 12,
  },
  videoEyebrow: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  videoNameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5 },
  videoName: { color: colors.text, fontSize: 20, lineHeight: 25, fontWeight: "900", maxWidth: "84%" },
  videoNameBadge: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  videoStatus: { color: colors.textMuted, fontSize: 12, lineHeight: 17, fontWeight: "800", marginTop: 4 },
  localVideoWrap: {
    position: "absolute",
    right: 14,
    top: 116,
    width: 110,
    height: 158,
    borderRadius: 22,
    zIndex: 7,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: colors.surface,
    ...cardShadow,
  },
  videoLocalSurface: { flex: 1 },
  videoLocalOff: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.surfaceMuted },
  videoLocalOffText: { color: colors.text, fontSize: 11, fontWeight: "900" },
  videoError: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 12,
    color: colors.danger,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 16,
    padding: 10,
    textAlign: "center",
    fontWeight: "800",
    overflow: "hidden",
  },
  videoControlsWrap: { backgroundColor: colors.tealMist, paddingHorizontal: 12, paddingTop: 10 },
  videoControlsCard: {
    minHeight: 88,
    borderRadius: 30,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    ...cardShadow,
  },
  videoControlButton: {
    flex: 1,
    minHeight: 62,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  videoControlActive: { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong },
  videoControlLabel: { color: colors.text, fontSize: 10, fontWeight: "900", textAlign: "center" },
  videoEndButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.danger,
  },
  screen: { flex: 1, backgroundColor: "#071716" },
  topbar: { minHeight: 82, paddingHorizontal: 16, paddingTop: 18, flexDirection: "row", alignItems: "center", gap: 12 },
  iconButton: { width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" },
  title: { color: "#fff", fontSize: 18, fontWeight: "900" },
  timer: { color: "rgba(255,255,255,0.72)", marginTop: 4 },
  audioArea: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  callIcon: { width: 104, height: 104, borderRadius: 52, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center", ...cardShadow },
  callTitle: { color: "#fff", marginTop: 22, fontSize: 23, fontWeight: "900" },
  callCopy: { color: "rgba(255,255,255,0.72)", textAlign: "center", lineHeight: 21, marginTop: 8 },
  videoArea: { flex: 1, backgroundColor: "#020617" },
  remoteVideo: { flex: 1 },
  localVideo: { position: "absolute", right: 14, top: 14, width: 112, height: 160, borderRadius: 18, zIndex: 2, overflow: "hidden" },
  localVideoOff: { position: "absolute", right: 14, top: 14, width: 112, height: 160, borderRadius: 18, zIndex: 2, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  waitingPanel: { flex: 1, alignItems: "center", justifyContent: "center" },
  waiting: { color: "#fff", textAlign: "center" },
  error: { color: "#fecdd3", textAlign: "center", paddingHorizontal: 18 },
  controls: { paddingHorizontal: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap" },
});
