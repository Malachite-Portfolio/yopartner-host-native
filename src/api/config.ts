export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://yopartner-backed-production.up.railway.app";

export const AGORA_APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID || "";
