import type { FirebaseAuthTypes } from "@react-native-firebase/auth";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getCurrentFirebaseUser, getCurrentIdToken, sendPhoneOtp, signOutFirebase } from "./firebasePhone";
import { isAuthorizationFailure, verifyBackendSession } from "./sessionApi";
import { clearPartnerSession, getPartnerBackendToken, getPartnerPhone, savePartnerSession } from "./tokenStore";
import { stopCallRingtone } from "../native/callRingtone";

type AuthContextValue = {
  initializing: boolean;
  signedIn: boolean;
  phone: string | null;
  authError: string;
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (code: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeIndiaPhone(rawPhone: string) {
  const digits = rawPhone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return `+91${digits.slice(-10)}`;
}

function getFirebaseAuthErrorDetails(error: unknown) {
  if (typeof error !== "object" || !error) {
    return { code: "", message: "", nativeErrorCode: "" };
  }

  const firebaseError = error as {
    code?: unknown;
    message?: unknown;
    nativeErrorCode?: unknown;
    nativeError?: { code?: unknown };
  };
  return {
    code: typeof firebaseError.code === "string" ? firebaseError.code : "",
    message: typeof firebaseError.message === "string" ? firebaseError.message : "",
    nativeErrorCode:
      typeof firebaseError.nativeErrorCode === "string" || typeof firebaseError.nativeErrorCode === "number"
        ? String(firebaseError.nativeErrorCode)
        : typeof firebaseError.nativeError?.code === "string" || typeof firebaseError.nativeError?.code === "number"
          ? String(firebaseError.nativeError.code)
          : "",
  };
}

function logFirebaseAuthError(operation: string, error: unknown) {
  const details = getFirebaseAuthErrorDetails(error);
  console.error(`[firebase-phone-auth] ${operation} failed`, {
    code: details.code || "unknown",
    message: details.message || "No Firebase error message provided.",
    nativeErrorCode: details.nativeErrorCode || null,
  });
}

function toFriendlyAuthError(error: unknown, fallback: string) {
  const details = getFirebaseAuthErrorDetails(error);
  const code = details.code.toLowerCase();
  const message = details.message.toLowerCase();
  const nativeErrorCode = details.nativeErrorCode.toLowerCase();
  if (code === "auth/too-many-requests") {
    return "Too many attempts. Try again later.";
  }
  if (code === "auth/invalid-phone-number") {
    return "Enter a valid phone number.";
  }
  if (code === "auth/quota-exceeded") {
    return "OTP quota exceeded. Try later.";
  }
  if (
    code === "auth/app-not-authorized" ||
    code === "auth/app-verification-failed" ||
    code === "auth/invalid-app-credential" ||
    code === "auth/missing-client-identifier" ||
    message.includes("app verification failed") ||
    nativeErrorCode.includes("app_not_authorized")
  ) {
    return "App verification failed. Firebase Android setup needs review.";
  }
  if (code === "auth/network-request-failed" || code === "auth/network-error") {
    return "Network issue. Check internet and try again.";
  }
  if (code === "auth/invalid-verification-code") {
    return "The OTP entered is incorrect. Please check and try again.";
  }
  if (code === "auth/session-expired") {
    return "This OTP has expired. Please request a fresh OTP.";
  }
  return fallback;
}

function isDebugBuild() {
  return Boolean((globalThis as { __DEV__?: boolean }).__DEV__);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const [token, storedPhone] = await Promise.all([getPartnerBackendToken(), getPartnerPhone()]);
      if (!mounted) return;
      if (token) {
        const session = await verifyBackendSession(token);
        if (isDebugBuild()) {
          console.log("[auth-bootstrap] session check", {
            status: session.data?.status ?? session.error?.status ?? null,
            userPresent: Boolean(session.data?.user),
            error: session.error?.message ?? null,
          });
        }
        if (isAuthorizationFailure(session.error)) {
          await clearPartnerSession();
          setSignedIn(false);
        } else {
          if (session.data?.backendToken && session.data.backendToken !== token) {
            await savePartnerSession({ backendToken: session.data.backendToken, phone: storedPhone });
          }
          setSignedIn(true);
          setPhone(storedPhone);
        }
      }
      setInitializing(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const sendOtp = useCallback(async (rawPhone: string) => {
    setAuthError("");
    const normalized = normalizeIndiaPhone(rawPhone);
    try {
      const nextConfirmation = await sendPhoneOtp(normalized);
      setConfirmation(nextConfirmation);
      setPhone(normalized);
    } catch (error) {
      logFirebaseAuthError("send OTP", error);
      setAuthError(toFriendlyAuthError(error, "Unable to send OTP right now. Please try again."));
      throw error;
    }
  }, []);

  const verifyOtp = useCallback(
    async (code: string) => {
      if (!confirmation) {
        setAuthError("Request OTP first.");
        return;
      }
      setAuthError("");
      try {
        await confirmation.confirm(code);
        const firebaseIdToken = await getCurrentIdToken(true);
        const firebaseUser = getCurrentFirebaseUser();
        if (!firebaseIdToken) throw new Error("Firebase token was not returned.");
        const session = await verifyBackendSession(firebaseIdToken);
        if (!session.data) {
          if (isAuthorizationFailure(session.error)) {
            setAuthError("Your login session could not be verified. Please login again.");
          } else {
            setAuthError("OTP verified, but the server could not be reached. Please try again.");
          }
          throw new Error(session.error?.message || "Unable to verify backend session.");
        }
        await clearPartnerSession();
        await savePartnerSession({
          backendToken: session.data.backendToken,
          firebaseIdToken,
          firebaseUid: firebaseUser?.uid ?? null,
          phone: firebaseUser?.phoneNumber ?? phone,
        });
        setSignedIn(true);
      } catch (error) {
        setAuthError((current) => current || toFriendlyAuthError(error, "Unable to verify OTP right now. Please try again."));
        throw error;
      }
    },
    [confirmation, phone],
  );

  const logout = useCallback(async () => {
    stopCallRingtone();
    await clearPartnerSession();
    await signOutFirebase().catch(() => undefined);
    setSignedIn(false);
    setConfirmation(null);
    setPhone(null);
  }, []);

  const value = useMemo(
    () => ({ initializing, signedIn, phone, authError, sendOtp, verifyOtp, logout }),
    [authError, initializing, logout, phone, sendOtp, signedIn, verifyOtp],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
