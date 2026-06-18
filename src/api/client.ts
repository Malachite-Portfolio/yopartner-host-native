import axios, { AxiosError, AxiosRequestConfig } from "axios";
import { getPartnerBackendToken } from "../auth/tokenStore";
import type { ApiError, ApiResult } from "../types/api";
import { API_BASE_URL } from "./config";

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});

client.interceptors.request.use(async (config) => {
  const token = await getPartnerBackendToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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

export async function apiRequest<T>(config: AxiosRequestConfig): Promise<ApiResult<T>> {
  try {
    const response = await client.request<T>(config);
    return { data: response.data, error: null, status: response.status };
  } catch (error) {
    const apiError = toApiError(error);
    return { data: null, error: apiError, status: apiError.status };
  }
}
