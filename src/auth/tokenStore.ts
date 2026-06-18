import * as SecureStore from "expo-secure-store";

export const PARTNER_BACKEND_TOKEN_KEY = "yopartner_host_backend_access_token";
export const PARTNER_FIREBASE_TOKEN_KEY = "yopartner_host_firebase_id_token";
export const PARTNER_FIREBASE_UID_KEY = "yopartner_host_firebase_uid";
export const PARTNER_EXPO_PUSH_TOKEN_KEY = "yopartner_host_expo_push_token";
export const PARTNER_FCM_TOKEN_KEY = "yopartner_host_fcm_token";
const PARTNER_PHONE_KEY = "yopartner_host_phone";
const PARTNER_LOCAL_CACHE_KEYS = [
  PARTNER_BACKEND_TOKEN_KEY,
  PARTNER_FIREBASE_TOKEN_KEY,
  PARTNER_FIREBASE_UID_KEY,
  PARTNER_EXPO_PUSH_TOKEN_KEY,
  PARTNER_FCM_TOKEN_KEY,
  PARTNER_PHONE_KEY,
  "yopartner_host_application_status",
  "yopartner_host_application",
  "yopartner_host_profile",
  "yopartner_host_onboarding_draft",
];

function normalizeToken(token?: string | null) {
  const normalized = token?.trim();
  return normalized ? normalized : null;
}

export async function savePartnerSession(input: {
  backendToken: string;
  firebaseIdToken?: string | null;
  firebaseUid?: string | null;
  phone?: string | null;
}) {
  await SecureStore.setItemAsync(PARTNER_BACKEND_TOKEN_KEY, input.backendToken);
  if (input.firebaseIdToken) await SecureStore.setItemAsync(PARTNER_FIREBASE_TOKEN_KEY, input.firebaseIdToken);
  if (input.firebaseUid) await SecureStore.setItemAsync(PARTNER_FIREBASE_UID_KEY, input.firebaseUid);
  if (input.phone) await SecureStore.setItemAsync(PARTNER_PHONE_KEY, input.phone);
}

export async function getPartnerBackendToken() {
  return normalizeToken(await SecureStore.getItemAsync(PARTNER_BACKEND_TOKEN_KEY));
}

export async function getPartnerFirebaseToken() {
  return normalizeToken(await SecureStore.getItemAsync(PARTNER_FIREBASE_TOKEN_KEY));
}

export async function getPartnerPhone() {
  return SecureStore.getItemAsync(PARTNER_PHONE_KEY);
}

export async function savePartnerExpoPushToken(token: string) {
  await SecureStore.setItemAsync(PARTNER_EXPO_PUSH_TOKEN_KEY, token);
}

export async function savePartnerFcmToken(token: string) {
  await SecureStore.setItemAsync(PARTNER_FCM_TOKEN_KEY, token);
}

export async function clearPartnerSession() {
  await Promise.all(PARTNER_LOCAL_CACHE_KEYS.map((key) => SecureStore.deleteItemAsync(key)));
}
