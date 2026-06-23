import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft, Camera, CameraOff, Check, Lock, Mic, MicOff, PhoneOff, RefreshCw, ShieldCheck, Volume2, VolumeX, Video } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { createAgoraRtcEngine, ChannelProfileType, ClientRoleType, RtcSurfaceView } from "react-native-agora";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { endSession, getSessionAgoraToken, markSessionMediaReady } from "../api/sessions";
import type { RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { cardShadow } from "../theme/styles";
import { formatClock } from "../utils/format";
import { CallControlButton } from "../components/CallControlButton";

type Props = NativeStackScreenProps<RootStackParamList, "Call">;

async function requestCallPermissions(video: boolean) {
  if (Platform.OS !== "android") return;
  const permissions = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  if (video) permissions.push(PermissionsAndroid.PERMISSIONS.CAMERA);
  await PermissionsAndroid.requestMultiple(permissions);
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
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [cameraOff, setCameraOff] = useState(false);

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
    const timer = setInterval(() => setSeconds((current) => current + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        await requestCallPermissions(video);
        const tokenResponse = await getSessionAgoraToken(sessionId);
        if (!tokenResponse.data) throw new Error(tokenResponse.error?.message || "Could not get Agora token.");
        const token = tokenResponse.data;
        engine.initialize({ appId: token.appId, channelProfile: ChannelProfileType.ChannelProfileCommunication });
        engine.registerEventHandler({
          onJoinChannelSuccess: () => {
            if (!mounted) return;
            setJoined(true);
            setJoining(false);
            void markSessionMediaReady(sessionId);
          },
          onUserJoined: (_connection, uid) => {
            if (mounted) setRemoteUid(uid);
          },
          onUserOffline: () => {
            if (mounted) setRemoteUid(null);
          },
          onError: (_err, msg) => {
            if (mounted) setError(msg || "Agora call error.");
          },
        });
        if (video) engine.enableVideo();
        engine.setEnableSpeakerphone(true);
        engine.joinChannel(String(token.token), String(token.channelName), Number(token.uid), {
          clientRoleType: ClientRoleType.ClientRoleBroadcaster,
          publishMicrophoneTrack: true,
          publishCameraTrack: video,
          autoSubscribeAudio: true,
          autoSubscribeVideo: video,
        });
      } catch (callError) {
        setJoining(false);
        setError(callError instanceof Error ? callError.message : "Unable to join call.");
      }
    })();
    return () => {
      mounted = false;
      try {
        engine.leaveChannel();
        engine.release();
      } catch {
        // Ignore cleanup errors.
      }
    };
  }, [engine, sessionId, video]);

  const partnerName = "YoPartner";
  const callStatus = joining ? "Joining securely..." : joined ? "Audio connected" : "Ready";
  const memberStatus = remoteUid ? "Member is connected." : "Waiting for member to join the session.";

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
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{video ? "Video conversation" : "Audio conversation"}</Text>
          <Text style={styles.timer}>{formatClock(seconds)}</Text>
        </View>
      </View>

      {video && joined ? (
        <View style={styles.videoArea}>
          {remoteUid ? <RtcSurfaceView canvas={{ uid: remoteUid }} style={styles.remoteVideo} /> : <View style={styles.waitingPanel}><Text style={styles.waiting}>Waiting for member video...</Text></View>}
          {!cameraOff ? <RtcSurfaceView canvas={{ uid: 0 }} style={styles.localVideo} /> : <View style={styles.localVideoOff}><CameraOff size={22} color={colors.white} /></View>}
        </View>
      ) : (
        <View style={styles.audioArea}>
          <View style={styles.callIcon}>{video ? <Video size={42} color={colors.primary} /> : <Mic size={42} color={colors.primary} />}</View>
          <Text style={styles.callTitle}>{joining ? "Joining securely..." : joined ? "Call connected" : "Ready"}</Text>
          <Text style={styles.callCopy}>{remoteUid ? "Member is connected." : "Waiting for member to join the session."}</Text>
          {joining ? <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} /> : null}
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.controls}>
        <CallControlButton label={muted ? "Unmute" : "Mute"} active={muted} onPress={toggleMute}>
          {muted ? <MicOff size={22} color={colors.white} /> : <Mic size={22} color={colors.white} />}
        </CallControlButton>
        <CallControlButton label={speaker ? "Speaker" : "Earpiece"} active={speaker} onPress={toggleSpeaker}>
          {speaker ? <Volume2 size={22} color={colors.white} /> : <VolumeX size={22} color={colors.white} />}
        </CallControlButton>
        {video ? (
          <>
            <CallControlButton label={cameraOff ? "Camera" : "Hide"} active={cameraOff} onPress={toggleCamera}>
              {cameraOff ? <CameraOff size={22} color={colors.white} /> : <Camera size={22} color={colors.white} />}
            </CallControlButton>
            <CallControlButton label="Flip" onPress={switchCamera}>
              <RefreshCw size={22} color={colors.white} />
            </CallControlButton>
          </>
        ) : null}
        <CallControlButton label="End" danger onPress={() => void leave()}>
          <PhoneOff size={22} color={colors.white} />
        </CallControlButton>
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
