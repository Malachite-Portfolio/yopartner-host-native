import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { getPartnerDashboard } from "../api/partner";
import { getMySessions, getSessionMessages } from "../api/sessions";
import { isActiveChatSession, showIncomingCall } from "../navigation/navigationRef";
import type { PartnerIncomingRequest, SessionRecord } from "../types/api";
import { getRequestMemberLabel, getSessionMemberLabel } from "../utils/partner";
import {
  CHAT_NOTIFICATION_CHANNEL,
  showPartnerLocalNotification,
} from "../utils/nativeNotifications";
import { useInterval } from "./useInterval";

function chatFingerprint(session: SessionRecord) {
  return `${session.updatedAt ?? ""}:${session.lastMessage ?? ""}`;
}

function isIncomingCall(request: PartnerIncomingRequest): request is PartnerIncomingRequest & { type: "AUDIO" | "VIDEO" } {
  return request.type === "AUDIO" || request.type === "VIDEO";
}

export function useForegroundActivityNotifications(enabled: boolean) {
  const runningRef = useRef(false);
  const initializedChatsRef = useRef(false);
  const chatFingerprintsRef = useRef(new Map<string, string>());
  const notifiedMessageIdsRef = useRef(new Set<string>());
  const handledCallIdsRef = useRef(new Set<string>());

  const checkActivity = useCallback(async () => {
    if (!enabled || AppState.currentState !== "active" || runningRef.current) return;
    runningRef.current = true;
    try {
      const [dashboardResponse, sessionsResponse] = await Promise.all([
        getPartnerDashboard(),
        getMySessions(),
      ]);

      const incomingCalls = (dashboardResponse.data?.pendingRequests ?? [])
        .filter(isIncomingCall)
        .sort((left, right) => new Date(left.createdAt ?? 0).getTime() - new Date(right.createdAt ?? 0).getTime());
      const nextCall = incomingCalls.find((request) => !handledCallIdsRef.current.has(request.id));
      if (nextCall) {
        const callerName = getRequestMemberLabel(nextCall);
        if (showIncomingCall({ requestId: nextCall.id, kind: nextCall.type, callerName })) {
          handledCallIdsRef.current.add(nextCall.id);
        }
      }

      const chatSessions = (sessionsResponse.data?.sessions ?? [])
        .filter((session) => session.serviceType === "CHAT" || session.type === "CHAT");
      if (!initializedChatsRef.current) {
        chatSessions.forEach((session) => chatFingerprintsRef.current.set(session.id, chatFingerprint(session)));
        initializedChatsRef.current = true;
        return;
      }

      for (const session of chatSessions) {
        const nextFingerprint = chatFingerprint(session);
        const previousFingerprint = chatFingerprintsRef.current.get(session.id);
        chatFingerprintsRef.current.set(session.id, nextFingerprint);
        if (!previousFingerprint || previousFingerprint === nextFingerprint || !session.lastMessage) continue;

        const messagesResponse = await getSessionMessages(session.id);
        const messages = messagesResponse.data?.messages ?? [];
        const latestMessage = messages[messages.length - 1];
        if (!latestMessage || latestMessage.senderRole === "PARTNER" || latestMessage.isMine === true) continue;
        if (notifiedMessageIdsRef.current.has(latestMessage.id)) continue;
        notifiedMessageIdsRef.current.add(latestMessage.id);
        if (isActiveChatSession(session.id)) continue;

        const sender = getSessionMemberLabel(session);
        void showPartnerLocalNotification({
          data: {
            type: "PARTNER_CHAT_MESSAGE",
            channel: CHAT_NOTIFICATION_CHANNEL,
            sessionId: session.id,
            messageId: latestMessage.id,
            title: sender,
            body: latestMessage.text || latestMessage.body || session.lastMessage,
          },
          title: sender,
          body: latestMessage.text || latestMessage.body || session.lastMessage,
          dedupeKey: `message:${latestMessage.id}`,
        }).catch(() => undefined);
      }
    } finally {
      runningRef.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      initializedChatsRef.current = false;
      chatFingerprintsRef.current.clear();
      notifiedMessageIdsRef.current.clear();
      handledCallIdsRef.current.clear();
      return;
    }
    void checkActivity();
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void checkActivity();
    });
    return () => subscription.remove();
  }, [checkActivity, enabled]);

  useInterval(() => {
    void checkActivity();
  }, enabled ? 4000 : null);
}
