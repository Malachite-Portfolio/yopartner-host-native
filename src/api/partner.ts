import type { AvailabilityStatus, PartnerApplicationsPayload, PartnerDashboardPayload, PartnerIncomingRequest } from "../types/api";
import { getPartnerBackendToken } from "../auth/tokenStore";
import { apiRequest } from "./client";
import { API_BASE_URL } from "./config";

export function getPartnerDashboard() {
  return apiRequest<PartnerDashboardPayload>({ url: "/api/partner/dashboard", method: "GET" });
}

export function getPartnerProfile() {
  return apiRequest<Record<string, unknown>>({ url: "/api/partner/profile", method: "GET" });
}

export function getPartnerApplications() {
  return apiRequest<PartnerApplicationsPayload>({ url: "/api/partner/applications", method: "GET" });
}

export function getMyPartnerApplication() {
  return apiRequest<PartnerApplicationsPayload>({ url: "/api/partner/applications/me", method: "GET" });
}

function isDebugBuild() {
  return Boolean((globalThis as { __DEV__?: boolean }).__DEV__);
}

function maskSubmitValue(key: string, value: unknown): unknown {
  const lowerKey = key.toLowerCase();
  if (value == null) return value;
  if (lowerKey.includes("token") || lowerKey.includes("authorization")) return "[masked]";
  if (typeof value === "string" && (lowerKey.includes("url") || lowerKey.includes("storagepath"))) {
    return value ? "[masked]" : value;
  }
  if (Array.isArray(value)) return value.map((item) => (typeof item === "string" ? item : maskSubmitBody(item)));
  if (typeof value === "object") return maskSubmitBody(value);
  return value;
}

function maskSubmitBody(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, maskSubmitValue(key, item)]),
  );
}

export async function submitPartnerApplication(payload: Record<string, unknown>) {
  const token = await getPartnerBackendToken();
  const endpoint = `${API_BASE_URL}/api/partner/applications`;
  if (isDebugBuild()) {
    console.log("[partner-submit] request", {
      endpoint,
      payloadKeys: Object.keys(payload).sort(),
      authTokenPresent: Boolean(token),
      payload: maskSubmitBody(payload),
    });
  }

  const result = await apiRequest<{ success?: boolean; message?: string }>({
    url: "/api/partner/applications",
    method: "POST",
    data: payload,
  });
  if (isDebugBuild()) {
    console.log("[partner-submit] response", {
      endpoint,
      status: result.status,
      body: result.error ? maskSubmitBody(result.error.details ?? result.error) : maskSubmitBody(result.data),
    });
  }
  return result;
}

export function getPartnerProfileMedia() {
  return apiRequest<{
    profileImageUrl: string | null;
    resolvedProfileImageUrl?: string | null;
    galleryImages: { imageUrl: string; storagePath: string }[];
  }>({ url: "/api/partner/profile/media", method: "GET" });
}

export function markPresenceOnline() {
  return apiRequest<{ effectiveStatus?: AvailabilityStatus; rawIsOnline?: boolean }>({
    url: "/api/partner/presence/online",
    method: "POST",
    data: {},
  });
}

export function heartbeatPresence() {
  return apiRequest<{ effectiveStatus?: AvailabilityStatus; rawIsOnline?: boolean }>({
    url: "/api/partner/presence/heartbeat",
    method: "POST",
    data: {},
  });
}

export function markPresenceOffline() {
  return apiRequest<{ effectiveStatus?: AvailabilityStatus; rawIsOnline?: boolean }>({
    url: "/api/partner/presence/offline",
    method: "POST",
    data: {},
  });
}

export function getPartnerRequests() {
  return apiRequest<{ pendingRequests: PartnerIncomingRequest[] }>({
    url: "/api/partner/requests",
    method: "GET",
  });
}

export function acceptPartnerRequest(requestId: string) {
  return apiRequest<Record<string, unknown>>({
    url: `/api/partner/requests/${requestId}/accept`,
    method: "POST",
    data: {},
  });
}

export function declinePartnerRequest(requestId: string) {
  return apiRequest<Record<string, unknown>>({
    url: `/api/partner/requests/${requestId}/decline`,
    method: "POST",
    data: {},
  });
}

export function getPartnerEarnings() {
  return apiRequest<{
    earnings: Record<string, unknown>[];
    payouts?: Record<string, unknown>[];
    summary?: Record<string, unknown>;
  }>({ url: "/api/partner/earnings", method: "GET" });
}

export function getPartnerPayoutSummary() {
  return apiRequest<{ summary: Record<string, unknown> }>({
    url: "/api/partner/payouts/summary",
    method: "GET",
  });
}

export function requestPartnerPayout(amount: number, note?: string) {
  return apiRequest<{ payout: Record<string, unknown>; summary: Record<string, unknown>; message?: string }>({
    url: "/api/partner/payouts/request",
    method: "POST",
    data: { amount, note },
  });
}
