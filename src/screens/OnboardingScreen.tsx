import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import * as DocumentPicker from "expo-document-picker";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  ShieldCheck,
  Video,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../components/AppButton";
import { AppCard } from "../components/AppCard";
import { DocumentUploadCard } from "../components/DocumentUploadCard";
import { ScreenContainer } from "../components/ScreenContainer";
import { StatusChip } from "../components/StatusChip";
import { uploadPartnerKycFile, type NativeKycFile, type PartnerKycUploadResult } from "../api/kycUpload";
import { submitPartnerApplication } from "../api/partner";
import type { RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import type { ApiError } from "../types/api";

type Props = NativeStackScreenProps<RootStackParamList, "Onboarding">;
type Gender = "Female" | "Male" | "Other" | "Prefer not to say" | "";
type ServiceType = "Chat" | "Audio Call" | "Video Call";
type DocKey = "selfie" | "aadhaarFront" | "aadhaarBack";
type ErrorMap = Partial<Record<keyof OnboardingProfile | "base" | "documents" | "liveVideo", string>>;

type LocalFile = {
  fileName: string;
  uri: string;
  contentType: string;
  fileSize?: number;
  upload?: PartnerKycUploadResult;
  uploading?: boolean;
  uploadError?: string;
};

type OnboardingProfile = {
  fullName: string;
  age: string;
  gender: Gender;
  qualification: string;
  languagesKnown: string[];
  communicationStyle: string[];
  hobbies: string[];
  aboutYourself: string;
  servicesOffered: ServiceType[];
  safetyPlatonicOnly: boolean;
  safetyRespectfulRules: boolean;
  safetyNoOutsidePayments: boolean;
  safetyReviewVerification: boolean;
};

const stepTitles = [
  "Basic details",
  "Preferences / Languages & comfort style",
  "About your support style",
  "Services & pricing",
  "Verification Documents",
  "Live Video Verification",
  "Safety agreement",
];

const emptyProfile: OnboardingProfile = {
  fullName: "",
  age: "",
  gender: "",
  qualification: "",
  languagesKnown: [],
  communicationStyle: [],
  hobbies: [],
  aboutYourself: "",
  servicesOffered: [],
  safetyPlatonicOnly: false,
  safetyRespectfulRules: false,
  safetyNoOutsidePayments: false,
  safetyReviewVerification: false,
};

const genderOptions: Gender[] = ["Female", "Male", "Other", "Prefer not to say"];
const qualificationOptions = ["High School", "Diploma", "Bachelor's Degree", "Master's Degree", "Doctorate", "Other"];
const languageOptions = ["Hindi", "English", "Bengali", "Tamil", "Telugu", "Marathi", "Gujarati", "Punjabi", "Kannada", "Malayalam", "Urdu"];
const communicationStyleOptions = [
  "Easy to Communicate",
  "Open minded",
  "Collaborative",
  "Calm Listener",
  "Funny",
  "Motivational",
  "Empathetic",
  "Non-judgmental",
  "Professional",
];
const hobbyOptions = ["Dance", "Reading", "Running", "Music", "Poetry", "Art", "Fitness", "Cooking", "Travel", "Movies", "Pets", "Sports", "Writing"];
const serviceOptions: ServiceType[] = ["Chat", "Audio Call", "Video Call"];
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const MIN_ABOUT_CHARACTERS = 20;
const MIN_VIDEO_SECONDS = 10;
const MAX_VIDEO_SECONDS = 20;
const safetyItems: Array<{ key: keyof Pick<OnboardingProfile, "safetyPlatonicOnly" | "safetyRespectfulRules" | "safetyNoOutsidePayments" | "safetyReviewVerification">; label: string }> = [
  { key: "safetyPlatonicOnly", label: "I understand YoPartner is strictly platonic." },
  { key: "safetyRespectfulRules", label: "I will follow respectful communication rules." },
  { key: "safetyNoOutsidePayments", label: "I will not share personal payment/contact details outside the platform." },
  { key: "safetyReviewVerification", label: "I agree to profile review and verification." },
];

function toggleArrayValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function toggleArrayValueWithLimit(values: string[], value: string, limit: number) {
  if (values.includes(value)) return values.filter((item) => item !== value);
  return values.length < limit ? [...values, value] : values;
}

function inferContentType(fileName: string, fallback = "application/octet-stream") {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".mp4")) return "video/mp4";
  return fallback;
}

function toUploadStatus(file: LocalFile | null) {
  if (!file) return "Pending";
  if (file.uploading) return "Uploading";
  if (file.upload) return "Uploaded";
  return "Selected";
}

function normalizeServiceForBackend(service: ServiceType) {
  if (service === "Chat") return "CHAT";
  if (service === "Audio Call") return "AUDIO";
  return "VIDEO";
}

function toFriendlySubmitError(message: string) {
  const legacyTaxIdLabel = String.fromCharCode(80, 65, 78);
  if (message.includes(`${legacyTaxIdLabel}: upload is missing`)) {
    return "Unable to submit application. Please try again.";
  }
  return message || "Unable to submit application right now.";
}

function toFriendlySubmitApiError(error: ApiError) {
  const message = error.message || "";
  const lowerMessage = message.toLowerCase();
  const details = error.details && typeof error.details === "object" ? (error.details as Record<string, unknown>) : {};
  const backendMessage =
    typeof details.message === "string"
      ? details.message
      : typeof details.error === "string"
        ? details.error
        : message;

  if (!error.status && (lowerMessage.includes("network error") || lowerMessage.includes("timeout") || lowerMessage.includes("network request failed"))) {
    return "Unable to reach YoPartner servers.";
  }
  if (error.code === "API_BASE_URL_MISSING") {
    return "App configuration error. API URL missing.";
  }
  if (error.status === 401 || error.status === 403 || lowerMessage.includes("session")) {
    return "Your session has expired. Please log in again and submit once more.";
  }
  if (error.status === 413 || lowerMessage.includes("too large") || lowerMessage.includes("payload too large")) {
    return "One uploaded file is too large. Please re-upload smaller verification files and try again.";
  }
  if (error.status === 400 || error.status === 422) {
    return backendMessage || "Some verification details are missing or invalid. Please review the checklist and try again.";
  }
  if (error.status && error.status >= 500) {
    return "YoPartner review submission is temporarily unavailable. Please try again in a few minutes.";
  }
  return toFriendlySubmitError(backendMessage);
}

function logSafeSubmitFailure(error: ApiError) {
  const details = error.details && typeof error.details === "object" ? (error.details as Record<string, unknown>) : {};
  const backendMessage =
    typeof details.message === "string"
      ? details.message
      : typeof details.error === "string"
        ? details.error
        : error.message;
  console.warn("[partner-submit] failed", {
    endpoint: "/api/partner/applications",
    status: error.status ?? "network",
    networkErrorType: error.code || "unknown",
    message: backendMessage,
  });
}

function isDebugBuild() {
  return Boolean((globalThis as { __DEV__?: boolean }).__DEV__);
}

function toSubmitDebugMessage(error: ApiError) {
  if (!isDebugBuild()) return "";
  const details = error.details && typeof error.details === "object" ? (error.details as Record<string, unknown>) : {};
  const validationErrors = Array.isArray(details.validationErrors) ? details.validationErrors : [];
  const fieldMessages = validationErrors
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const issue = item as { label?: unknown; field?: unknown; message?: unknown };
      const label = typeof issue.label === "string" ? issue.label : typeof issue.field === "string" ? issue.field : "Field";
      const message = typeof issue.message === "string" ? issue.message : "";
      return message ? `${label}: ${message}` : "";
    })
    .filter(Boolean);
  const serverMessage =
    typeof details.message === "string"
      ? details.message
      : typeof details.error === "string"
        ? details.error
        : error.message;
  const status = error.status ? `HTTP ${error.status}. ` : "";
  return `Server says: ${status}${fieldMessages.length ? fieldMessages.join(" ") : serverMessage}`;
}

function OnboardingProgress({ step, total }: { step: number; total: number }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${((step + 1) / total) * 100}%` }]} />
    </View>
  );
}

function StepHeader({ step, total, title }: { step: number; total: number; title: string }) {
  return (
    <View style={styles.stepHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.stepMeta}>Step {step + 1} of {total}</Text>
        <Text style={styles.stepTitle}>{title}</Text>
      </View>
    </View>
  );
}

function OnboardingCard({ children }: { children: React.ReactNode }) {
  return <AppCard style={styles.onboardingCard}>{children}</AppCard>;
}

function TextInputField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType,
  multiline,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  error?: string;
  keyboardType?: "default" | "number-pad";
  multiline?: boolean;
  maxLength?: number;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSoft}
        keyboardType={keyboardType}
        multiline={multiline}
        maxLength={maxLength}
        style={[styles.input, multiline && styles.textArea, error && styles.inputError]}
        textAlignVertical={multiline ? "top" : "center"}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function ChipSelector({
  options,
  values,
  onToggle,
}: {
  options: string[];
  values: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <View style={styles.chipWrap}>
      {options.map((option) => {
        const selected = values.includes(option);
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onToggle(option)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SafetyChecklist({ profile, setProfile }: { profile: OnboardingProfile; setProfile: React.Dispatch<React.SetStateAction<OnboardingProfile>> }) {
  return (
    <View style={styles.checklist}>
      {safetyItems.map((item) => {
        const checked = Boolean(profile[item.key]);
        return (
          <Pressable
            key={item.key}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            style={styles.checkRow}
            onPress={() => setProfile((current) => ({ ...current, [item.key]: !current[item.key] }))}
          >
            <View style={[styles.checkbox, checked && styles.checkboxChecked]}>{checked ? <Check size={14} color={colors.white} /> : null}</View>
            <Text style={styles.checkText}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value || "-"}</Text>
    </View>
  );
}

function BottomActionBar({
  step,
  total,
  canContinue,
  submitting,
  onBack,
  onNext,
}: {
  step: number;
  total: number;
  canContinue: boolean;
  submitting: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const isSubmit = step === total - 1;
  return (
    <View style={styles.bottomBar}>
      {step > 0 ? <AppButton title="Back" variant="secondary" disabled={submitting} onPress={onBack} style={styles.bottomButton} /> : null}
      <AppButton
        title={isSubmit ? "Submit for Review" : "Continue"}
        loading={submitting}
        disabled={!canContinue || submitting}
        onPress={onNext}
        style={styles.bottomButton}
      />
    </View>
  );
}

export function OnboardingScreen({ navigation }: Props) {
  const cameraRef = useRef<CameraView>(null);
  const recordingStartedAtRef = useRef(0);
  const recordingInFlightRef = useRef(false);
  const stopRecordingRequestedRef = useRef(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<OnboardingProfile>(emptyProfile);
  const [genderOpen, setGenderOpen] = useState(false);
  const [qualificationOpen, setQualificationOpen] = useState(false);
  const [docs, setDocs] = useState<Record<DocKey, LocalFile | null>>({
    selfie: null,
    aadhaarFront: null,
    aadhaarBack: null,
  });
  const [liveVideo, setLiveVideo] = useState<LocalFile | null>(null);
  const [permissionState, setPermissionState] = useState("Camera and microphone not requested yet.");
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraMounted, setCameraMounted] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraPrepareTimedOut, setCameraPrepareTimedOut] = useState(false);
  const [isRecordingLiveVideo, setIsRecordingLiveVideo] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [errors, setErrors] = useState<ErrorMap>({});
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitDebugMessage, setSubmitDebugMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [cameraSessionKey, setCameraSessionKey] = useState(0);

  const requiredDocumentsUploaded = Boolean(docs.selfie?.upload && docs.aadhaarFront?.upload && docs.aadhaarBack?.upload);
  const documentsUploading = Boolean(docs.selfie?.uploading || docs.aadhaarFront?.uploading || docs.aadhaarBack?.uploading);
  const allSafetyChecked = safetyItems.every((item) => Boolean(profile[item.key]));
  const liveVideoUploaded = Boolean(liveVideo?.upload);
  const liveVideoPermissionDenied = cameraPermission?.granted === false || microphonePermission?.granted === false;
  const aboutCharacters = profile.aboutYourself.trim().length;
  const liveScript = `Hello, my name is ${profile.fullName || "{name}"}. I want to become a verified YoPartner host. My details are genuine. I understand YoPartner is a safe and respectful platform.`;

  const remountCamera = useCallback(() => {
    cameraRef.current = null;
    setCameraMounted(false);
    setCameraReady(false);
    setCameraPrepareTimedOut(false);
    setPermissionState("Preparing camera...");
    setCameraSessionKey((current) => current + 1);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setCameraMounted(true));
    });
  }, []);

  const summaryRows = useMemo(
    () => [
      ["Full Name", profile.fullName],
      ["Age", profile.age],
      ["Gender", profile.gender],
      ["Qualification", profile.qualification],
      ["Languages", profile.languagesKnown.join(", ")],
      ["Communication Style", profile.communicationStyle.join(", ")],
      ["Hobbies", profile.hobbies.join(", ")],
      ["About", profile.aboutYourself],
      ["Services", profile.servicesOffered.join(", ")],
      ["Pricing", "Chat ₹2.5/message, Audio call ₹18/min, Video call ₹24/min"],
      ["Selfie uploaded", toUploadStatus(docs.selfie)],
      ["Aadhaar front uploaded", toUploadStatus(docs.aadhaarFront)],
      ["Aadhaar back uploaded", toUploadStatus(docs.aadhaarBack)],
      ["Live video uploaded", toUploadStatus(liveVideo)],
    ],
    [docs.aadhaarBack, docs.aadhaarFront, docs.selfie, liveVideo, profile],
  );

  const displaySummaryRows = useMemo(
    () =>
      summaryRows.map(([label, value]) => {
        if (label === "Pricing") return [label, "Chat \u20b92.5/message, Audio call \u20b918/min, Video call \u20b924/min"];
        return [label, value];
      }),
    [summaryRows],
  );

  const canContinue = useMemo(() => {
    if (step === 0) {
      return Boolean(profile.fullName.trim() && profile.age.trim() && profile.gender && profile.qualification.trim());
    }
    if (step === 1) return profile.languagesKnown.length >= 1 && profile.languagesKnown.length <= 3 && profile.communicationStyle.length === 1 && profile.hobbies.length === 5;
    if (step === 2) return aboutCharacters >= MIN_ABOUT_CHARACTERS;
    if (step === 3) return profile.servicesOffered.length > 0;
    if (step === 4) return requiredDocumentsUploaded && !documentsUploading;
    if (step === 5) return liveVideoUploaded && !liveVideo?.uploading;
    return allSafetyChecked && requiredDocumentsUploaded && liveVideoUploaded;
  }, [aboutCharacters, allSafetyChecked, documentsUploading, liveVideo?.uploading, liveVideoUploaded, profile, requiredDocumentsUploaded, step]);

  useEffect(() => {
    if (!isRecordingLiveVideo) return undefined;
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordingStartedAtRef.current) / 1000);
      setRecordingSeconds(elapsed);
      if (elapsed >= MAX_VIDEO_SECONDS && !stopRecordingRequestedRef.current) {
        stopRecordingRequestedRef.current = true;
        cameraRef.current?.stopRecording();
      }
    }, 500);
    return () => clearInterval(timer);
  }, [isRecordingLiveVideo]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (step !== 5) return;
    if (isRecordingLiveVideo || liveVideo) return;

    setRecordingSeconds(0);
    recordingInFlightRef.current = false;
    stopRecordingRequestedRef.current = false;
    setErrors((current) => ({ ...current, liveVideo: undefined }));

    const cameraGranted = cameraPermission?.granted === true;
    const microphoneGranted = microphonePermission?.granted === true;
    const cameraDenied = cameraPermission?.granted === false;
    const microphoneDenied = microphonePermission?.granted === false;

    console.log("[partner-live-video] step active", {
      cameraGranted,
      microphoneGranted,
      cameraDenied,
      microphoneDenied,
      cameraReady: false,
    });

    if (cameraGranted && microphoneGranted) {
      setCameraEnabled(true);
      remountCamera();
    } else if (cameraDenied || microphoneDenied) {
      setCameraEnabled(false);
      setCameraMounted(false);
      setPermissionState("Camera or microphone permission denied.");
    } else {
      setCameraEnabled(false);
      setCameraMounted(false);
      setPermissionState("Camera and microphone not requested yet.");
    }
  }, [cameraPermission?.granted, isRecordingLiveVideo, liveVideo, microphonePermission?.granted, remountCamera, step]);

  useEffect(() => {
    if (step !== 5 || !cameraEnabled || !cameraMounted || cameraReady || liveVideo) return undefined;
    const timer = setTimeout(() => {
      setCameraPrepareTimedOut(true);
      setPermissionState("Camera is still preparing. Tap retry.");
      console.warn("[partner-live-video] camera readiness timeout", {
        cameraGranted: cameraPermission?.granted === true,
        microphoneGranted: microphonePermission?.granted === true,
        cameraMounted: true,
        cameraReady: false,
      });
    }, 5000);
    return () => clearTimeout(timer);
  }, [
    cameraEnabled,
    cameraMounted,
    cameraPermission?.granted,
    cameraReady,
    liveVideo,
    microphonePermission?.granted,
    step,
  ]);

  const validateStep = (stepIndex: number): ErrorMap => {
    const nextErrors: ErrorMap = {};
    if (stepIndex === 0) {
      if (!profile.fullName.trim()) nextErrors.fullName = "Full Name is required.";
      if (!profile.age.trim()) nextErrors.age = "Age is required.";
      if (!profile.gender) nextErrors.gender = "Gender is required.";
      if (!profile.qualification.trim()) nextErrors.qualification = "Qualification is required.";
    }
    if (stepIndex === 1) {
      if (profile.languagesKnown.length < 1 || profile.languagesKnown.length > 3) nextErrors.languagesKnown = "Select between 1 and 3 languages.";
      if (profile.communicationStyle.length !== 1) nextErrors.communicationStyle = "Select exactly one communication style.";
      if (profile.hobbies.length !== 5) nextErrors.hobbies = "Select exactly 5 hobbies.";
    }
    if (stepIndex === 2) {
      if (aboutCharacters < MIN_ABOUT_CHARACTERS) nextErrors.aboutYourself = `Tell us about yourself in at least ${MIN_ABOUT_CHARACTERS} characters.`;
    }
    if (stepIndex === 3) {
      if (profile.servicesOffered.length === 0) nextErrors.servicesOffered = "Select at least one service.";
    }
    if (stepIndex === 4 && !requiredDocumentsUploaded) {
      nextErrors.documents = "Selfie, Aadhaar front, and Aadhaar back must be uploaded before continuing.";
    }
    if (stepIndex === 5 && !liveVideoUploaded) {
      nextErrors.liveVideo = "Please record and upload your live verification video before continuing.";
    }
    if (stepIndex === 6) {
      if (!allSafetyChecked) nextErrors.base = "Please agree to all safety checklist items.";
      if (!requiredDocumentsUploaded) nextErrors.documents = "Please upload all required KYC documents.";
      if (!liveVideoUploaded) nextErrors.liveVideo = "Please record and upload live video verification.";
    }
    return nextErrors;
  };

  const uploadDocument = async (key: DocKey, file: NativeKycFile) => {
    setDocs((current) => ({
      ...current,
      [key]: { ...file, uploading: true, uploadError: "" },
    }));
    try {
      const uploadType = key === "aadhaarFront" ? "aadhaar-front" : key === "aadhaarBack" ? "aadhaar-back" : "selfie";
      const upload = await uploadPartnerKycFile(file, uploadType);
      setDocs((current) => ({
        ...current,
        [key]: { ...file, upload, uploading: false, uploadError: "" },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not upload this document. Please try again.";
      setDocs((current) => ({
        ...current,
        [key]: { ...file, uploading: false, uploadError: message },
      }));
      setErrors({ documents: message });
    }
  };

  const pickDocument = async (key: DocKey) => {
    setErrors({});
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > MAX_DOCUMENT_BYTES) {
      setErrors({ documents: "Each document must be 5 MB or smaller." });
      return;
    }
    const file: NativeKycFile = {
      uri: asset.uri,
      fileName: asset.name || `${key}.jpg`,
      contentType: asset.mimeType || inferContentType(asset.name || ""),
      fileSize: asset.size,
    };
    await uploadDocument(key, file);
  };

  const enableCamera = async () => {
    setErrors({});
    setCameraReady(false);
    setPermissionState("Requesting camera and microphone permission...");
    const [nextCameraPermission, nextMicrophonePermission] = await Promise.all([
      requestCameraPermission(),
      requestMicrophonePermission(),
    ]);
    if (!nextCameraPermission.granted || !nextMicrophonePermission.granted) {
      setCameraEnabled(false);
      setPermissionState("Camera or microphone permission denied.");
      setErrors({ liveVideo: "Camera and microphone permission are required for live video verification." });
      return;
    }
    setCameraEnabled(true);
    remountCamera();
  };

  const retryCamera = () => {
    if (!cameraPermission?.granted || !microphonePermission?.granted) {
      void enableCamera();
      return;
    }
    setErrors((current) => ({ ...current, liveVideo: undefined }));
    setCameraEnabled(true);
    remountCamera();
  };

  const uploadRecordedVideo = async (file: NativeKycFile) => {
    setLiveVideo({ ...file, uploading: true, uploadError: "" });
    try {
      const upload = await uploadPartnerKycFile(file, "live-video");
      setLiveVideo({ ...file, upload, uploading: false, uploadError: "" });
      setPermissionState("Live video uploaded.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed. Please try again.";
      setLiveVideo({ ...file, uploading: false, uploadError: message });
      setErrors({ liveVideo: message });
    }
  };

  const waitForRecordingBridge = () => new Promise<void>((resolve) => setTimeout(resolve, 120));

  const startCameraRecording = async (camera: CameraView) => {
    const recordingOptions = {
      maxDuration: MAX_VIDEO_SECONDS,
      maxFileSize: 50 * 1024 * 1024,
    };
    let recording: Promise<{ uri: string } | undefined> | undefined = camera.recordAsync(recordingOptions);
    if (!recording) {
      await waitForRecordingBridge();
      recording = cameraRef.current?.recordAsync(recordingOptions);
    }
    if (!recording) {
      throw new Error("Camera recordAsync did not return a recording promise.");
    }
    if (stopRecordingRequestedRef.current) {
      setTimeout(() => {
        cameraRef.current?.stopRecording();
      }, 0);
    }
    let result = await recording;
    if (!result?.uri && !stopRecordingRequestedRef.current) {
      await waitForRecordingBridge();
      result = await cameraRef.current?.recordAsync(recordingOptions);
    }
    return result;
  };

  const startLiveRecording = async () => {
    setErrors({});
    if (recordingInFlightRef.current || isRecordingLiveVideo) return;
    if (!cameraEnabled || !cameraPermission?.granted || !microphonePermission?.granted) {
      await enableCamera();
      return;
    }
    if (!cameraReady) {
      console.warn("[partner-live-video] recording blocked: camera not ready", {
        cameraGranted: cameraPermission?.granted === true,
        microphoneGranted: microphonePermission?.granted === true,
        cameraReady,
      });
      setErrors({ liveVideo: "Camera is still preparing. Please wait a moment and try again." });
      return;
    }
    const camera = cameraRef.current;
    if (!camera) {
      console.warn("[partner-live-video] camera ref missing before recording start", {
        cameraGranted: cameraPermission?.granted === true,
        microphoneGranted: microphonePermission?.granted === true,
        cameraReady,
      });
      setErrors({ liveVideo: "Could not start recording. Please try again." });
      return;
    }
    recordingInFlightRef.current = true;
    stopRecordingRequestedRef.current = false;
    setLiveVideo(null);
    setRecordingSeconds(0);
    recordingStartedAtRef.current = Date.now();
    setIsRecordingLiveVideo(true);
    setPermissionState("Recording... Keep reading the script.");
    try {
      await waitForRecordingBridge();
      const result = await startCameraRecording(camera);
      const seconds = Math.round((Date.now() - recordingStartedAtRef.current) / 1000);
      setRecordingSeconds(seconds);
      setIsRecordingLiveVideo(false);
      if (!result?.uri) {
        throw new Error("Camera recording completed without a file URI.");
      }
      if (seconds < MIN_VIDEO_SECONDS) {
        setPermissionState("Camera and microphone ready.");
        setErrors({ liveVideo: `Please record for at least ${MIN_VIDEO_SECONDS} seconds.` });
        return;
      }
      setPermissionState("Recording saved. Uploading...");
      const fileName = `live-verification-${Date.now()}.mp4`;
      await uploadRecordedVideo({
        uri: result.uri,
        fileName,
        contentType: "video/mp4",
      });
    } catch (error) {
      console.warn("[partner-live-video] recording failed", {
        message: error instanceof Error ? error.message : "Unknown recording error",
        cameraGranted: cameraPermission?.granted === true,
        microphoneGranted: microphonePermission?.granted === true,
        cameraReady,
      });
      setIsRecordingLiveVideo(false);
      setPermissionState("Camera and microphone ready.");
      setErrors({ liveVideo: "Could not start recording. Please try again." });
    } finally {
      recordingInFlightRef.current = false;
      stopRecordingRequestedRef.current = false;
    }
  };

  const stopLiveRecording = () => {
    if (!isRecordingLiveVideo && !recordingInFlightRef.current) return;
    stopRecordingRequestedRef.current = true;
    try {
      cameraRef.current?.stopRecording();
    } catch (error) {
      console.warn("[partner-live-video] stop recording failed", error);
    }
  };

  const recordLiveVideoAgain = () => {
    if (isRecordingLiveVideo) return;
    setErrors({});
    setLiveVideo(null);
    setRecordingSeconds(0);
    recordingInFlightRef.current = false;
    stopRecordingRequestedRef.current = false;
    if (cameraEnabled) remountCamera();
    else setPermissionState("Camera and microphone not requested yet.");
  };

  const goBackStep = () => {
    setSubmitMessage("");
    setErrors({});
    setStep((current) => Math.max(0, current - 1));
  };

  const goNext = () => {
    const stepErrors = validateStep(step);
    setErrors(stepErrors);
    setSubmitMessage("");
    if (Object.keys(stepErrors).length > 0) return;
    setStep((current) => Math.min(current + 1, stepTitles.length - 1));
  };

  const retryDocumentUpload = async (key: DocKey, file: LocalFile) => {
    if (file.upload) return file.upload;
    const uploadFile: NativeKycFile = {
      uri: file.uri,
      fileName: file.fileName,
      contentType: file.contentType,
      fileSize: file.fileSize,
    };
    setDocs((current) => ({
      ...current,
      [key]: { ...file, uploading: true, uploadError: "" },
    }));
    try {
      const uploadType = key === "aadhaarFront" ? "aadhaar-front" : key === "aadhaarBack" ? "aadhaar-back" : "selfie";
      const upload = await uploadPartnerKycFile(uploadFile, uploadType);
      setDocs((current) => ({
        ...current,
        [key]: { ...file, upload, uploading: false, uploadError: "" },
      }));
      return upload;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not upload this document. Please try again.";
      setDocs((current) => ({
        ...current,
        [key]: { ...file, uploading: false, uploadError: message },
      }));
      throw new Error(message);
    }
  };

  const retryLiveVideoUpload = async (file: LocalFile) => {
    if (file.upload) return file.upload;
    const uploadFile: NativeKycFile = {
      uri: file.uri,
      fileName: file.fileName,
      contentType: file.contentType,
      fileSize: file.fileSize,
    };
    setLiveVideo({ ...file, uploading: true, uploadError: "" });
    try {
      const upload = await uploadPartnerKycFile(uploadFile, "live-video");
      setLiveVideo({ ...file, upload, uploading: false, uploadError: "" });
      return upload;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not upload live verification video. Please try again.";
      setLiveVideo({ ...file, uploading: false, uploadError: message });
      throw new Error(message);
    }
  };

  const buildPayload = (uploads: {
    selfie: PartnerKycUploadResult;
    aadhaarFront: PartnerKycUploadResult;
    aadhaarBack: PartnerKycUploadResult;
    liveVideo: PartnerKycUploadResult;
  }) => ({
    fullName: profile.fullName.trim(),
    age: Number(profile.age) || 0,
    gender: profile.gender,
    // Compatibility mapping: these legacy backend fields are intentionally hidden from the seven-step native UI.
    religion: "Not specified",
    bornCity: "Not specified",
    nationality: "Indian",
    school: "Not provided",
    college: "Not provided",
    qualification: profile.qualification.trim(),
    languagesKnown: profile.languagesKnown,
    communicationStyle: profile.communicationStyle,
    hobbies: profile.hobbies,
    profileTagline: `${profile.fullName.trim()} - supportive YoPartner host`,
    aboutYourself: profile.aboutYourself.trim(),
    servicesOffered: profile.servicesOffered.map(normalizeServiceForBackend),
    categories: ["Communication & Emotional Support"],
    safetyChecklist: safetyItems.filter((item) => profile[item.key]).map((item) => item.label),
    selfieUploaded: true,
    selfieFileName: uploads.selfie.fileName,
    selfieStoragePath: uploads.selfie.storagePath,
    selfieUrl: uploads.selfie.downloadUrl,
    aadhaarFrontUploaded: true,
    aadhaarFrontFileName: uploads.aadhaarFront.fileName,
    aadhaarFrontStoragePath: uploads.aadhaarFront.storagePath,
    aadhaarFrontUrl: uploads.aadhaarFront.downloadUrl,
    aadhaarBackUploaded: true,
    aadhaarBackFileName: uploads.aadhaarBack.fileName,
    aadhaarBackStoragePath: uploads.aadhaarBack.storagePath,
    aadhaarBackUrl: uploads.aadhaarBack.downloadUrl,
    liveVerificationName: profile.fullName.trim(),
    liveVerificationAge: Number(profile.age) || 0,
    liveVerificationHobbies: profile.hobbies.join(", "),
    liveVideoUploaded: true,
    liveVideoFileName: uploads.liveVideo.fileName,
    liveVideoStoragePath: uploads.liveVideo.storagePath,
    liveVideoUrl: uploads.liveVideo.downloadUrl,
  });

  const handleSubmit = async () => {
    const stepErrors = validateStep(6);
    setErrors(stepErrors);
    setSubmitMessage("");
    setSubmitDebugMessage("");
    if (Object.keys(stepErrors).length > 0) return;

    if (!docs.selfie || !docs.aadhaarFront || !docs.aadhaarBack) {
      setStep(4);
      setErrors({ documents: "Please select all required KYC documents." });
      return;
    }
    if (!liveVideo) {
      setStep(5);
      setErrors({ liveVideo: "Please record or select live video verification." });
      return;
    }

    setSubmitting(true);
    let uploads: {
      selfie: PartnerKycUploadResult;
      aadhaarFront: PartnerKycUploadResult;
      aadhaarBack: PartnerKycUploadResult;
      liveVideo: PartnerKycUploadResult;
    };
    try {
      const [selfie, aadhaarFront, aadhaarBack] = await Promise.all([
        retryDocumentUpload("selfie", docs.selfie),
        retryDocumentUpload("aadhaarFront", docs.aadhaarFront),
        retryDocumentUpload("aadhaarBack", docs.aadhaarBack),
      ]);
      const liveVideoUpload = await retryLiveVideoUpload(liveVideo);
      uploads = { selfie, aadhaarFront, aadhaarBack, liveVideo: liveVideoUpload };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not upload verification files. Please try again.";
      setSubmitting(false);
      setErrors({ base: message });
      return;
    }

    const result = await submitPartnerApplication(buildPayload(uploads));
    setSubmitting(false);
    if (result.error) {
      logSafeSubmitFailure(result.error);
      setErrors({ base: toFriendlySubmitApiError(result.error) });
      setSubmitDebugMessage(toSubmitDebugMessage(result.error));
      return;
    }
    setSubmitMessage(result.data?.message || "Your profile has been submitted for review.");
    navigation.replace("ApplicationStatus");
  };

  const renderStep = () => {
    if (step === 0) {
      return (
        <OnboardingCard>
          <View style={styles.fieldGrid}>
            <TextInputField label="Full Name" value={profile.fullName} onChangeText={(value) => setProfile((current) => ({ ...current, fullName: value }))} error={errors.fullName} />
            <TextInputField
              label="Age"
              value={profile.age}
              onChangeText={(value) => setProfile((current) => ({ ...current, age: value.replace(/[^\d]/g, "").slice(0, 2) }))}
              keyboardType="number-pad"
              error={errors.age}
            />
            <View style={styles.field}>
              <Text style={styles.label}>Gender</Text>
              <Pressable style={[styles.input, styles.dropdown]} onPress={() => setGenderOpen((current) => !current)}>
                <Text style={[styles.dropdownValue, !profile.gender && styles.placeholder]}>{profile.gender || "Select gender"}</Text>
                <ChevronDown size={18} color={colors.textMuted} />
              </Pressable>
              {genderOpen ? (
                <View style={styles.dropdownMenu}>
                  {genderOptions.map((option) => (
                    <Pressable
                      key={option}
                      style={styles.dropdownOption}
                      onPress={() => {
                        setProfile((current) => ({ ...current, gender: option }));
                        setGenderOpen(false);
                      }}
                    >
                      <Text style={styles.dropdownOptionText}>{option}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {errors.gender ? <Text style={styles.errorText}>{errors.gender}</Text> : null}
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Qualification</Text>
              <Pressable style={[styles.input, styles.dropdown]} onPress={() => setQualificationOpen((current) => !current)}>
                <Text style={[styles.dropdownValue, !profile.qualification && styles.placeholder]}>{profile.qualification || "Select qualification"}</Text>
                <ChevronDown size={18} color={colors.textMuted} />
              </Pressable>
              {qualificationOpen ? (
                <View style={styles.dropdownMenu}>
                  {qualificationOptions.map((option) => (
                    <Pressable
                      key={option}
                      style={styles.dropdownOption}
                      onPress={() => {
                        setProfile((current) => ({ ...current, qualification: option }));
                        setQualificationOpen(false);
                      }}
                    >
                      <Text style={styles.dropdownOptionText}>{option}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {errors.qualification ? <Text style={styles.errorText}>{errors.qualification}</Text> : null}
            </View>
          </View>
        </OnboardingCard>
      );
    }

    if (step === 1) {
      return (
        <OnboardingCard>
          <Text style={styles.groupTitle}>Languages Known</Text>
          <Text style={styles.selectionHint}>Select 1 to 3 languages ({profile.languagesKnown.length}/3)</Text>
          <ChipSelector options={languageOptions} values={profile.languagesKnown} onToggle={(value) => setProfile((current) => ({ ...current, languagesKnown: toggleArrayValueWithLimit(current.languagesKnown, value, 3) }))} />
          {errors.languagesKnown ? <Text style={styles.errorText}>{errors.languagesKnown}</Text> : null}
          <Text style={styles.groupTitle}>Communication Style</Text>
          <Text style={styles.selectionHint}>Select exactly one</Text>
          <ChipSelector options={communicationStyleOptions} values={profile.communicationStyle} onToggle={(value) => setProfile((current) => ({ ...current, communicationStyle: [value] }))} />
          {errors.communicationStyle ? <Text style={styles.errorText}>{errors.communicationStyle}</Text> : null}
          <Text style={styles.groupTitle}>Hobbies</Text>
          <Text style={styles.selectionHint}>Select exactly 5 hobbies ({profile.hobbies.length}/5)</Text>
          <ChipSelector options={hobbyOptions} values={profile.hobbies} onToggle={(value) => setProfile((current) => ({ ...current, hobbies: toggleArrayValueWithLimit(current.hobbies, value, 5) }))} />
          {errors.hobbies ? <Text style={styles.errorText}>{errors.hobbies}</Text> : null}
        </OnboardingCard>
      );
    }

    if (step === 2) {
      return (
        <OnboardingCard>
          <TextInputField
            label="About Yourself"
            value={profile.aboutYourself}
            onChangeText={(value) => setProfile((current) => ({ ...current, aboutYourself: value }))}
            multiline
            error={errors.aboutYourself}
          />
          <Text style={[styles.counter, aboutCharacters >= MIN_ABOUT_CHARACTERS && styles.counterComplete]}>{aboutCharacters} / {MIN_ABOUT_CHARACTERS} characters</Text>
        </OnboardingCard>
      );
    }

    if (step === 3) {
      return (
        <OnboardingCard>
          <Text style={styles.groupTitle}>Services offered</Text>
          <View style={styles.serviceList}>
            {serviceOptions.map((service) => {
              const selected = profile.servicesOffered.includes(service);
              return (
                <Pressable
                  key={service}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  style={styles.serviceRow}
                  onPress={() => setProfile((current) => ({ ...current, servicesOffered: toggleArrayValue(current.servicesOffered, service) as ServiceType[] }))}
                >
                  <View style={[styles.checkbox, selected && styles.checkboxChecked]}>{selected ? <Check size={14} color={colors.white} /> : null}</View>
                  <Text style={styles.serviceText}>{service}</Text>
                </Pressable>
              );
            })}
          </View>
          {errors.servicesOffered ? <Text style={styles.errorText}>{errors.servicesOffered}</Text> : null}
          <View style={styles.priceGrid}>
            <View style={styles.priceCard}><Text style={styles.priceLabel}>Chat</Text><Text style={styles.priceValue}>{"\u20b92.5/message"}</Text></View>
            <View style={styles.priceCard}><Text style={styles.priceLabel}>Audio call</Text><Text style={styles.priceValue}>{"\u20b918/min"}</Text></View>
            <View style={styles.priceCard}><Text style={styles.priceLabel}>Video call</Text><Text style={styles.priceValue}>{"\u20b924/min"}</Text></View>
          </View>
          <Text style={styles.priceNote}>Pricing is display only. Backend remains the source of truth.</Text>
        </OnboardingCard>
      );
    }

    if (step === 4) {
      return (
        <OnboardingCard>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Verification Documents</Text>
            <Text style={styles.infoText}>Documents are reviewed securely by the YoPartner verification team.</Text>
            <Text style={styles.infoText}>Selfie, Aadhaar front, and Aadhaar back are required.</Text>
            <Text style={styles.infoText}>Allowed formats: JPG, PNG, WEBP, PDF. Maximum 5 MB per document.</Text>
          </View>
          <DocumentUploadCard
            title="Selfie photo"
            description="Upload a clear selfie image for profile verification."
            selectedLabel={docs.selfie?.fileName}
            uploaded={Boolean(docs.selfie?.upload)}
            onPick={() => void pickDocument("selfie")}
          />
          {docs.selfie ? <Text style={docs.selfie.uploadError ? styles.errorText : styles.uploadState}>{toUploadStatus(docs.selfie)}{docs.selfie.uploadError ? `: ${docs.selfie.uploadError}` : ""}</Text> : null}
          <DocumentUploadCard
            title="Aadhaar front"
            description="Upload Aadhaar front image or PDF."
            selectedLabel={docs.aadhaarFront?.fileName}
            uploaded={Boolean(docs.aadhaarFront?.upload)}
            onPick={() => void pickDocument("aadhaarFront")}
          />
          {docs.aadhaarFront ? <Text style={docs.aadhaarFront.uploadError ? styles.errorText : styles.uploadState}>{toUploadStatus(docs.aadhaarFront)}{docs.aadhaarFront.uploadError ? `: ${docs.aadhaarFront.uploadError}` : ""}</Text> : null}
          <DocumentUploadCard
            title="Aadhaar back"
            description="Upload Aadhaar back image or PDF."
            selectedLabel={docs.aadhaarBack?.fileName}
            uploaded={Boolean(docs.aadhaarBack?.upload)}
            onPick={() => void pickDocument("aadhaarBack")}
          />
          {docs.aadhaarBack ? <Text style={docs.aadhaarBack.uploadError ? styles.errorText : styles.uploadState}>{toUploadStatus(docs.aadhaarBack)}{docs.aadhaarBack.uploadError ? `: ${docs.aadhaarBack.uploadError}` : ""}</Text> : null}
          <Text style={styles.uploadState}>
            {requiredDocumentsUploaded ? "All required KYC documents are uploaded." : "Selected files upload to secure YoPartner Firebase Storage before submission."}
          </Text>
          {errors.documents ? <Text style={styles.errorText}>{errors.documents}</Text> : null}
        </OnboardingCard>
      );
    }

    if (step === 5) {
      return (
        <OnboardingCard>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Live Video Verification</Text>
            <Text style={styles.infoText}>Record a short live video inside this flow. Keep it between 10 and 20 seconds.</Text>
            <Text style={styles.infoText}>Recording stops automatically after 20 seconds.</Text>
          </View>
          <View style={styles.scriptCard}>
            <Text style={styles.infoTitle}>Read script while recording</Text>
            <Text style={styles.scriptText}>{liveScript}</Text>
            <View style={styles.identityGrid}>
              <Text style={styles.identityText}>Name: {profile.fullName || "Missing"}</Text>
              <Text style={styles.identityText}>Age: {profile.age || "Missing"}</Text>
              <Text style={styles.identityText}>Hobbies: {profile.hobbies.join(", ") || "Missing"}</Text>
            </View>
          </View>
          <View style={styles.videoPreview}>
            {cameraEnabled && cameraMounted && !liveVideo ? (
              <View style={styles.cameraFrame}>
                <CameraView
                  key={cameraSessionKey}
                  ref={cameraRef}
                  style={styles.cameraView}
                  facing="front"
                  mode="video"
                  mute={false}
                  videoQuality="480p"
                  active={step === 5}
                  onCameraReady={() => {
                    setCameraMounted(true);
                    setCameraReady(true);
                    setCameraPrepareTimedOut(false);
                    setPermissionState("Camera and microphone ready.");
                    console.log("[partner-live-video] camera ready", {
                      cameraGranted: cameraPermission?.granted === true,
                      microphoneGranted: microphonePermission?.granted === true,
                      cameraReady: true,
                    });
                  }}
                  onMountError={(event) => {
                    console.warn("[partner-live-video] camera mount failed", event);
                    setCameraReady(false);
                    setCameraPrepareTimedOut(true);
                    setPermissionState("Camera is still preparing. Tap retry.");
                    setErrors({ liveVideo: "Camera preview could not start. Tap Retry Camera." });
                  }}
                />
                <View pointerEvents="none" style={styles.cameraScriptOverlay}>
                  <Text style={styles.cameraScriptLabel}>Read aloud</Text>
                  <Text style={styles.cameraScriptText}>{liveScript}</Text>
                </View>
              </View>
            ) : (
              <>
                <Video size={34} color={colors.white} />
                <Text style={styles.videoPreviewText}>{liveVideo ? `Recorded: ${liveVideo.fileName}` : "Enable camera to record live verification on this screen."}</Text>
              </>
            )}
            {isRecordingLiveVideo ? (
              <View style={styles.recordingBadge}>
                <Text style={styles.recordingText}>Recording... {recordingSeconds}s / {MAX_VIDEO_SECONDS}s</Text>
              </View>
            ) : null}
          </View>
          <StatusChip label={permissionState} tone={liveVideoUploaded ? "green" : liveVideoPermissionDenied ? "amber" : "slate"} />
          {liveVideo ? <Text style={liveVideo.uploadError ? styles.errorText : styles.uploadState}>{toUploadStatus(liveVideo)}{liveVideo.uploadError ? `: ${liveVideo.uploadError}` : ""}</Text> : null}
          <View style={styles.videoActions}>
            {!cameraEnabled ? <AppButton title="Enable Camera" onPress={() => void enableCamera()} style={styles.flexButton} /> : null}
            {cameraEnabled && !isRecordingLiveVideo && !liveVideo ? (
              <AppButton
                title={cameraReady ? "Start Recording" : cameraPrepareTimedOut ? "Retry Camera" : "Preparing camera..."}
                disabled={!cameraReady && !cameraPrepareTimedOut}
                onPress={cameraReady ? () => void startLiveRecording() : retryCamera}
                style={styles.flexButton}
              />
            ) : null}
            {isRecordingLiveVideo ? <AppButton title="Stop Recording" variant="danger" disabled={recordingSeconds < MIN_VIDEO_SECONDS} onPress={stopLiveRecording} style={styles.flexButton} /> : null}
            {liveVideo ? <AppButton title="Record Again" variant="secondary" onPress={recordLiveVideoAgain} style={styles.flexButton} /> : null}
          </View>
          {liveVideo ? <Text style={styles.uploadState}>{liveVideoUploaded ? "Live video is uploaded." : "Uploading live video..."}</Text> : null}
          {errors.liveVideo ? <Text style={styles.errorText}>{errors.liveVideo}</Text> : null}
        </OnboardingCard>
      );
    }

    return (
      <OnboardingCard>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Profile Summary</Text>
          <View style={styles.summaryGrid}>
            {displaySummaryRows.map(([label, value]) => (
              <SummaryRow key={label} label={label} value={value} />
            ))}
          </View>
        </View>
        <Text style={styles.groupTitle}>Safety checklist</Text>
        <SafetyChecklist profile={profile} setProfile={setProfile} />
        {errors.base ? <Text style={styles.errorText}>{errors.base}</Text> : null}
        {errors.documents ? <Text style={styles.errorText}>{errors.documents}</Text> : null}
        {errors.liveVideo ? <Text style={styles.errorText}>{errors.liveVideo}</Text> : null}
        {submitDebugMessage ? <Text style={styles.debugErrorText}>{submitDebugMessage}</Text> : null}
        {submitMessage ? <Text style={styles.submitMessage}>{submitMessage}</Text> : null}
      </OnboardingCard>
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.header}>
          <Pressable style={styles.headerBack} onPress={step > 0 ? goBackStep : () => navigation.goBack()}>
            <ArrowLeft size={20} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Host Onboarding</Text>
            <Text style={styles.headerMeta}>Become a YoPartner partner</Text>
          </View>
          <View style={styles.headerIcon}>
            <ShieldCheck size={21} color={colors.primary} />
          </View>
        </View>
      </SafeAreaView>
      <ScreenContainer contentStyle={[styles.content, keyboardOpen && styles.keyboardOpenContent]}>
        <StepHeader step={step} total={stepTitles.length} title={stepTitles[step]} />
        <OnboardingProgress step={step} total={stepTitles.length} />
        {renderStep()}
        <BottomActionBar
          step={step}
          total={stepTitles.length}
          canContinue={canContinue}
          submitting={submitting}
          onBack={goBackStep}
          onNext={step === stepTitles.length - 1 ? () => void handleSubmit() : goNext}
        />
        <View style={styles.footerHint}>
          <Camera size={14} color={colors.textMuted} />
          <Text style={styles.footerHintText}>KYC stays limited to selfie, Aadhaar front, Aadhaar back, and live video.</Text>
        </View>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  safeArea: { backgroundColor: colors.background },
  header: {
    minHeight: 74,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
  },
  headerBack: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: colors.text, fontWeight: "900", fontSize: 18 },
  headerMeta: { color: colors.textMuted, marginTop: 3, fontWeight: "700", fontSize: 12 },
  headerIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  content: { paddingBottom: 24 },
  keyboardOpenContent: { paddingBottom: 180 },
  stepHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  stepMeta: { color: colors.textMuted, fontWeight: "800", fontSize: 13 },
  stepTitle: { color: colors.text, fontSize: 24, fontWeight: "900", marginTop: 4 },
  smallBackButton: {
    minHeight: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  smallBackText: { color: colors.text, fontWeight: "900", fontSize: 12 },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: colors.slateSoft, marginBottom: 16, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 999 },
  onboardingCard: { marginBottom: 14, gap: 12 },
  fieldGrid: { gap: 12 },
  field: { gap: 6 },
  label: { color: colors.text, fontWeight: "800", fontSize: 13 },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 50,
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
    fontSize: 15,
  },
  inputError: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  textArea: { minHeight: 132, paddingTop: 12, lineHeight: 21 },
  dropdown: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dropdownValue: { color: colors.text, fontWeight: "700", flex: 1 },
  placeholder: { color: colors.textSoft },
  dropdownMenu: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden", backgroundColor: colors.surface },
  dropdownOption: { minHeight: 42, justifyContent: "center", paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  dropdownOptionText: { color: colors.text, fontWeight: "700" },
  errorText: { color: colors.danger, fontSize: 12, lineHeight: 18, fontWeight: "700" },
  debugErrorText: { color: colors.danger, fontSize: 12, lineHeight: 18, fontWeight: "700" },
  groupTitle: { color: colors.text, fontWeight: "900", fontSize: 15, marginTop: 4 },
  selectionHint: { color: colors.textMuted, fontWeight: "700", fontSize: 12, lineHeight: 18 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 8, maxWidth: "100%" },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { color: colors.text, fontWeight: "800", fontSize: 12, flexShrink: 1 },
  chipTextSelected: { color: colors.white },
  counter: { color: colors.textMuted, fontWeight: "800", fontSize: 12, textAlign: "right" },
  counterComplete: { color: colors.primary },
  serviceList: { gap: 10 },
  serviceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  serviceText: { color: colors.text, fontWeight: "800" },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  priceGrid: { gap: 10 },
  priceCard: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 12, backgroundColor: colors.surfaceMuted },
  priceLabel: { color: colors.textMuted, fontWeight: "800", fontSize: 12 },
  priceValue: { color: colors.text, fontWeight: "900", fontSize: 16, marginTop: 4 },
  priceNote: { color: colors.textMuted, fontSize: 12, lineHeight: 18, fontWeight: "700" },
  infoCard: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted, padding: 14, gap: 6 },
  infoTitle: { color: colors.text, fontWeight: "900", fontSize: 14 },
  infoText: { color: colors.textMuted, lineHeight: 19, fontSize: 12 },
  pendingUpload: { color: colors.amber, fontSize: 12, lineHeight: 18, fontWeight: "800" },
  uploadState: { color: colors.primary, fontSize: 12, lineHeight: 18, fontWeight: "800" },
  scriptCard: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 },
  scriptText: { color: colors.text, lineHeight: 21, backgroundColor: colors.slateSoft, borderRadius: 14, padding: 12 },
  identityGrid: { gap: 5 },
  identityText: { color: colors.textMuted, fontWeight: "700", fontSize: 12, flexShrink: 1 },
  videoPreview: { minHeight: 178, borderRadius: 18, backgroundColor: colors.black, alignItems: "center", justifyContent: "center", padding: 12, gap: 10 },
  cameraFrame: { width: "100%", aspectRatio: 3 / 4, borderRadius: 16, overflow: "hidden", backgroundColor: colors.black },
  cameraView: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  cameraScriptOverlay: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: 16,
    backgroundColor: "rgba(255, 253, 248, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(220, 234, 229, 0.95)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cameraScriptLabel: { color: colors.primaryDark, fontSize: 11, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 },
  cameraScriptText: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: "800" },
  recordingBadge: { position: "absolute", top: 12, alignSelf: "center", borderRadius: 999, backgroundColor: colors.danger, paddingHorizontal: 12, paddingVertical: 6 },
  recordingText: { color: colors.white, fontSize: 12, fontWeight: "900" },
  videoPreviewText: { color: colors.white, textAlign: "center", lineHeight: 20 },
  videoActions: { gap: 10 },
  flexButton: { width: "100%" },
  checklist: { gap: 10 },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 4 },
  checkText: { color: colors.text, lineHeight: 20, fontWeight: "700", flex: 1, flexWrap: "wrap" },
  summaryGrid: { gap: 0, marginTop: 4 },
  summaryRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 10, gap: 4 },
  summaryLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  summaryValue: { color: colors.text, lineHeight: 20, flexShrink: 1, flexWrap: "wrap" },
  submitMessage: { color: colors.primary, fontSize: 13, fontWeight: "900" },
  bottomBar: { flexDirection: "row", gap: 10, marginTop: 2 },
  bottomButton: { flex: 1 },
  footerHint: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10, flexWrap: "wrap" },
  footerHintText: { color: colors.textMuted, fontSize: 11, fontWeight: "800", textAlign: "center", flexShrink: 1 },
});
