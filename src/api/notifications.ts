import { apiRequest } from "./client";

export function registerPartnerFcmToken(token: string) {
  return apiRequest<{ message?: string; token?: Record<string, unknown> }>({
    url: "/api/notifications/fcm-tokens",
    method: "POST",
    data: {
      token,
      platform: "android",
      appPackage: "com.yopartner.host",
      appVersion: "1.0.0",
    },
  });
}
