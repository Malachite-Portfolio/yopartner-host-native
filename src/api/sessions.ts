import type { AgoraTokenPayload, SessionMessage, SessionRecord } from "../types/api";
import { apiRequest } from "./client";

export function getMySessions() {
  return apiRequest<{ sessions: SessionRecord[] }>({ url: "/api/sessions", method: "GET" });
}

export function getSessionById(sessionId: string) {
  return apiRequest<{ session: SessionRecord }>({ url: `/api/sessions/${sessionId}`, method: "GET" });
}

export function getSessionMessages(sessionId: string) {
  return apiRequest<{ messages: SessionMessage[] }>({
    url: `/api/sessions/${sessionId}/messages`,
    method: "GET",
  });
}

export function sendSessionMessage(sessionId: string, body: string, clientMessageId: string) {
  return apiRequest<{ message: SessionMessage; walletBalance?: number; chargeAmount?: number }>({
    url: `/api/sessions/${sessionId}/messages`,
    method: "POST",
    headers: { "Idempotency-Key": clientMessageId },
    data: { body, clientMessageId },
  });
}

export function endSession(sessionId: string) {
  return apiRequest<{ session: SessionRecord; message?: string }>({
    url: `/api/sessions/${sessionId}/end`,
    method: "POST",
    data: {},
  });
}

export function getSessionAgoraToken(sessionId: string) {
  return apiRequest<AgoraTokenPayload>({
    url: `/api/sessions/${sessionId}/agora-token`,
    method: "GET",
  });
}

export function markSessionMediaReady(sessionId: string) {
  return apiRequest<{ session: SessionRecord }>({
    url: `/api/sessions/${sessionId}/mark-live`,
    method: "POST",
    data: { mediaReady: true },
  });
}
