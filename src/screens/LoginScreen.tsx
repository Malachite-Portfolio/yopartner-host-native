import { ArrowLeft, Check, ShieldCheck } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthProvider";
import { AppButton } from "../components/AppButton";
import { AppCard } from "../components/AppCard";
import { StatusChip } from "../components/StatusChip";
import { colors } from "../theme/colors";

function normalizeIndiaPhone(rawPhone: string) {
  const digits = rawPhone.replace(/\D/g, "");
  if (digits.length >= 12 && digits.startsWith("91")) return `+${digits.slice(0, 12)}`;
  return `+91${digits.slice(-10)}`;
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const lastFour = digits.slice(-4).padStart(4, "X");
  return `+91 ******${lastFour}`;
}

function AuthProgress({ step }: { step: 1 | 2 }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: step === 1 ? "50%" : "100%" }]} />
    </View>
  );
}

export function LoginScreen() {
  const { sendOtp, verifyOtp, authError } = useAuth();
  const { height, width } = useWindowDimensions();
  const otpInputRef = useRef<TextInput>(null);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [localError, setLocalError] = useState("");

  const compact = height < 700 || width < 360;
  const phoneDigits = phone.replace(/\D/g, "").slice(-10);
  const canRequestOtp = phoneDigits.length === 10 && termsAccepted && !loading && resendIn <= 0;
  const canVerifyOtp = otp.trim().length === 6 && !loading;
  const e164Preview = useMemo(() => (phoneDigits.length === 10 ? normalizeIndiaPhone(phoneDigits) : "+91XXXXXXXXXX"), [phoneDigits]);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn((current) => Math.max(0, current - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const handleSend = async () => {
    setLocalError("");
    if (phoneDigits.length !== 10) {
      setLocalError("Enter a valid 10-digit mobile number.");
      return;
    }
    if (!termsAccepted) {
      setLocalError("Please accept the Terms of Use and Privacy Policy.");
      return;
    }
    if (!canRequestOtp) return;
    setLoading(true);
    try {
      await sendOtp(phoneDigits);
      setOtpSent(true);
      setOtp("");
      setResendIn(45);
      setTimeout(() => otpInputRef.current?.focus(), 120);
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
      if (code === "auth/too-many-requests") setResendIn(300);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setLocalError("");
    if (!canVerifyOtp) return;
    setLoading(true);
    try {
      await verifyOtp(otp);
    } finally {
      setLoading(false);
    }
  };

  const resetToPhone = () => {
    setOtpSent(false);
    setOtp("");
    setLocalError("");
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <ScrollView
          style={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, compact && styles.compactContent]}
        >
          <View style={[styles.hero, compact && styles.compactHero]}>
            {otpSent ? (
              <Pressable style={styles.backButton} onPress={resetToPhone}>
                <ArrowLeft size={18} color={colors.text} />
                <Text style={styles.backText}>Back</Text>
              </Pressable>
            ) : null}
            <Image
              accessibilityLabel="YoPartner"
              resizeMode="contain"
              source={require("../../assets/yopartner-logo.png")}
              style={[styles.logo, compact && styles.compactLogo]}
            />
          </View>

          <AppCard style={styles.card}>
            <Text style={styles.stepMeta}>STEP {otpSent ? "2" : "1"}</Text>
            <AuthProgress step={otpSent ? 2 : 1} />
            <Text style={[styles.title, compact && styles.compactTitle]}>{otpSent ? "Verify Your Number" : "Welcome to YoPartner"}</Text>
            <Text style={styles.subtitle}>
              {otpSent ? `Enter the secure verification code sent to ${maskPhone(e164Preview)}.` : "Enter your number to receive a secure verification code."}
            </Text>

            {!otpSent ? (
              <>
                <Text style={styles.label}>Phone number</Text>
                <View style={styles.phoneRow}>
                  <View style={styles.prefix}><Text style={styles.prefixText}>+91</Text></View>
                  <TextInput
                    keyboardType="phone-pad"
                    placeholder="98765 43210"
                    placeholderTextColor={colors.textSoft}
                    value={phone}
                    onChangeText={(value) => setPhone(value.replace(/\D/g, "").slice(0, 10))}
                    style={[styles.input, styles.phoneInput]}
                    editable={!loading}
                    maxLength={10}
                  />
                </View>
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: termsAccepted }} style={styles.termsBox} onPress={() => setTermsAccepted((current) => !current)}>
                  <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>{termsAccepted ? <Check size={14} color={colors.white} /> : null}</View>
                  <Text style={styles.termsText}>I agree to the Terms of Use and Privacy Policy.</Text>
                </Pressable>
                <AppButton
                  title={resendIn > 0 ? `Send Verification Code in ${resendIn}s` : "Send Verification Code"}
                  loading={loading}
                  disabled={!canRequestOtp}
                  onPress={() => void handleSend()}
                />
                <Text style={styles.helper}>We only use your number for OTP authentication and account security.</Text>
                <View style={styles.statusRow}>
                  <StatusChip label="Firebase OTP" tone={termsAccepted && phoneDigits.length === 10 ? "green" : "slate"} />
                </View>
              </>
            ) : (
              <>
                <Pressable style={[styles.otpBoxes, compact && styles.compactOtpBoxes]} onPress={() => otpInputRef.current?.focus()}>
                  {Array.from({ length: 6 }).map((_, index) => (
                    <View key={index} style={[styles.otpBox, compact && styles.compactOtpBox, otp[index] && styles.otpBoxFilled]}>
                      <Text style={styles.otpDigit}>{otp[index] || ""}</Text>
                    </View>
                  ))}
                </Pressable>
                <TextInput
                  ref={otpInputRef}
                  keyboardType="number-pad"
                  value={otp}
                  onChangeText={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))}
                  style={styles.hiddenOtpInput}
                  maxLength={6}
                  editable={!loading}
                />
                <View style={styles.otpActions}>
                  <Pressable disabled={resendIn > 0 || loading} onPress={() => void handleSend()} style={[styles.textAction, (resendIn > 0 || loading) && styles.disabledTextAction]}>
                    <Text style={styles.textActionLabel}>{resendIn > 0 ? `Resend in ${resendIn}s` : "Resend OTP"}</Text>
                  </Pressable>
                  <Pressable disabled={loading} onPress={resetToPhone} style={styles.textAction}>
                    <Text style={styles.textActionLabel}>Edit phone number</Text>
                  </Pressable>
                </View>
                <AppButton title="Verify & Continue" loading={loading} disabled={!canVerifyOtp} onPress={() => void handleVerify()} />
                <View style={styles.trustRow}>
                  {["Secure", "Private", "Trusted"].map((item) => <StatusChip key={item} label={item} tone="green" />)}
                </View>
              </>
            )}

            {localError || authError ? <Text style={styles.error}>{localError || authError}</Text> : null}
            {!otpSent && resendIn > 0 ? <Text style={styles.cooldown}>Try again in {resendIn}s</Text> : null}
          </AppCard>

          <Text style={styles.note}>This app never retries OTP automatically.</Text>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", padding: 18, paddingBottom: 22 },
  compactContent: { justifyContent: "flex-start", paddingHorizontal: 14, paddingTop: 12 },
  hero: { alignItems: "center", marginBottom: 16 },
  compactHero: { marginBottom: 10 },
  backButton: {
    alignSelf: "flex-start",
    minHeight: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  backText: { color: colors.text, fontWeight: "900" },
  logo: { width: 264, height: 91, maxWidth: "100%" },
  compactLogo: { width: 218, height: 75 },
  card: { gap: 12 },
  stepMeta: { color: colors.primary, fontSize: 12, fontWeight: "900", letterSpacing: 0, textTransform: "uppercase", textAlign: "center" },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: colors.slateSoft, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: colors.primary },
  title: { color: colors.text, fontSize: 26, fontWeight: "900", textAlign: "center" },
  compactTitle: { fontSize: 22 },
  subtitle: { color: colors.textMuted, textAlign: "center", lineHeight: 21 },
  label: { color: colors.text, fontWeight: "800", fontSize: 13 },
  phoneRow: { flexDirection: "row", gap: 8 },
  prefix: { minHeight: 50, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  prefixText: { color: colors.primary, fontWeight: "900" },
  phoneInput: { flex: 1 },
  input: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, minHeight: 50, paddingHorizontal: 14, color: colors.text, backgroundColor: colors.surfaceMuted, fontSize: 16 },
  termsBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted, padding: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  checkboxChecked: { borderColor: colors.primary, backgroundColor: colors.primary },
  termsText: { color: colors.text, flex: 1, lineHeight: 19, fontWeight: "700" },
  helper: { color: colors.textMuted, fontSize: 12, textAlign: "center", lineHeight: 18 },
  statusRow: { alignItems: "center" },
  otpBoxes: { flexDirection: "row", gap: 8, justifyContent: "center" },
  compactOtpBoxes: { gap: 6 },
  otpBox: { width: 43, height: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  compactOtpBox: { width: 38, height: 48, borderRadius: 12 },
  otpBoxFilled: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  otpDigit: { color: colors.text, fontWeight: "900", fontSize: 20 },
  hiddenOtpInput: { width: 1, height: 1, opacity: 0 },
  otpActions: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  textAction: { paddingVertical: 10, flexShrink: 1 },
  disabledTextAction: { opacity: 0.45 },
  textActionLabel: { color: colors.primary, fontWeight: "900" },
  trustRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18, textAlign: "center", fontWeight: "700" },
  cooldown: { color: colors.textMuted, fontSize: 12, fontWeight: "800", textAlign: "center" },
  note: { marginTop: 14, color: colors.textMuted, textAlign: "center", fontSize: 12 },
});
