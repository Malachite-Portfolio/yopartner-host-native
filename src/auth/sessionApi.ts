import axios, { AxiosError } from "axios";
import type { ApiError } from "../types/api";
import { API_BASE_URL } from "../api/config";

type BackendSessionPayload = {
  token?: unknown;
  accessToken?: unknown;
  jwt?: unknown;
  user?: unknown;
  data?: {
    token?: unknown;
    accessToken?: unknown;
    jwt?: unknown;
    user?: unknown;
  };
};

export type BackendSessionResult = {
  backendToken: string;
  user: unknown;
  status: number;
};

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function extractBackendToken(payload: BackendSessionPayload, fallbackToken: string) {
  return (
    stringValue(payload.token) ||
    stringValue(payload.accessToken) ||
    stringValue(payload.jwt) ||
    stringValue(payload.data?.token) ||
    stringValue(payload.data?.accessToken) ||
    stringValue(payload.data?.jwt) ||
    fallbackToken
  );
}

function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string; error?: string; code?: string }>;
    const status = axiosError.response?.status;
    const payload = axiosError.response?.data;
    const message = payload?.message || payload?.error || axiosError.message || "Request failed.";
    return {
      status,
      code: payload?.code || payload?.error,
      message:
        /unable to verify (the )?user session/i.test(message) && status !== 401 && status !== 403
          ? "Session check is temporarily unavailable. Please try again."
          : message,
      details: payload,
    };
  }
  return { message: error instanceof Error ? error.message : "Request failed." };
}

export function isAuthorizationFailure(error?: ApiError | null) {
  return error?.status === 401 || error?.status === 403;
}

export async function verifyBackendSession(token: string): Promise<{ data: BackendSessionResult | null; error: ApiError | null }> {
  try {
    const response = await axios.get<BackendSessionPayload>(`${API_BASE_URL}/api/auth/me`, {
      timeout: 20000,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const payload = response.data ?? {};
    return {
      data: {
        backendToken: extractBackendToken(payload, token),
        user: payload.user ?? payload.data?.user ?? null,
        status: response.status,
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: toApiError(error) };
  }
}
