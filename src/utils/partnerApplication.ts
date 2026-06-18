import { getMyPartnerApplication, getPartnerApplications, getPartnerDashboard } from "../api/partner";
import { getCurrentFirebaseUser } from "../auth/firebasePhone";
import type { PartnerApplicationsPayload, PartnerDashboardPayload } from "../types/api";
import { asRecord } from "./partner";

export type PartnerApplicationRouteState = "APPROVED" | "NOT_STARTED" | "DRAFT" | "PENDING" | "NEEDS_INFO" | "REJECTED";

export type CurrentPartnerApplicationState = {
  application: Record<string, unknown>;
  dashboard: PartnerDashboardPayload | null;
  hasApplication: boolean;
  status: PartnerApplicationRouteState;
  message: string;
};

const EDITABLE_STATUSES = new Set(["DRAFT", "NEEDS_INFO", "REJECTED"]);

export function normalizeApplicationStatus(raw: unknown): PartnerApplicationRouteState {
  const status = String(raw ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (!status || status === "NOT_SUBMITTED" || status === "NONE" || status === "NULL") return "NOT_STARTED";
  if (status === "UNDER_REVIEW" || status === "IN_REVIEW" || status === "SUBMITTED") return "PENDING";
  if (status === "MORE_INFO" || status === "CHANGES_REQUESTED") return "NEEDS_INFO";
  if (status === "APPROVED" || status === "ACTIVE") return "APPROVED";
  if (status === "REJECTED" || status === "DECLINED") return "REJECTED";
  if (status === "DRAFT") return "DRAFT";
  return "PENDING";
}

export function isEditableApplicationStatus(status: string) {
  return EDITABLE_STATUSES.has(normalizeApplicationStatus(status));
}

function normalizePhone(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? digits.slice(-10) : "";
}

function stringField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function applicationMatchesCurrentUser(application: Record<string, unknown>, uid: string, phone: string) {
  if (!Object.keys(application).length) return false;
  const payload = asRecord(application.payload);
  const applicantUser = asRecord(application.applicantUser ?? application.user);
  const firebaseUid = stringField(application, ["firebaseUid", "uid", "applicantFirebaseUid", "applicantUid"]) ||
    stringField(payload, ["firebaseUid", "uid"]) ||
    stringField(applicantUser, ["firebaseUid", "uid"]);
  if (firebaseUid && firebaseUid === uid) return true;

  const appPhone = normalizePhone(
    stringField(application, ["phone", "phoneNumber", "applicantPhone", "userPhone"]) ||
      stringField(payload, ["phone", "phoneNumber"]) ||
      stringField(applicantUser, ["phone", "phoneNumber"]),
  );
  return Boolean(appPhone && phone && appPhone === phone);
}

function pickCurrentApplication(payload: PartnerApplicationsPayload | null, uid: string, phone: string) {
  const direct = asRecord(payload?.application);
  if (Object.keys(direct).length) return direct;

  const applications = Array.isArray(payload?.applications) ? payload.applications : [];
  return applications.find((item) => applicationMatchesCurrentUser(asRecord(item), uid, phone)) ?? {};
}

function statusFromDashboard(dashboard: PartnerDashboardPayload | null) {
  return normalizeApplicationStatus(dashboard?.applicationStatus ?? dashboard?.approvalState?.applicationStatus);
}

function messageFromApplication(application: Record<string, unknown>, dashboard: PartnerDashboardPayload | null) {
  const payload = asRecord(application.payload);
  return (
    stringField(application, ["adminNote", "rejectionReason", "rejectionMessage", "reason", "message"]) ||
    stringField(payload, ["adminNote", "rejectionReason", "rejectionMessage", "reason"]) ||
    String(dashboard?.message ?? "")
  );
}

function isDebugBuild() {
  return Boolean((globalThis as { __DEV__?: boolean }).__DEV__);
}

export async function getCurrentPartnerApplicationState(): Promise<CurrentPartnerApplicationState> {
  const user = getCurrentFirebaseUser();
  const uid = user?.uid ?? "";
  const phone = normalizePhone(user?.phoneNumber);
  const [scopedApplication, dashboard] = await Promise.all([getMyPartnerApplication(), getPartnerDashboard()]);

  let application = pickCurrentApplication(scopedApplication.data, uid, phone);
  if (scopedApplication.error?.status === 404 || scopedApplication.error?.status === 405) {
    const fallbackApplications = await getPartnerApplications();
    application = pickCurrentApplication(fallbackApplications.data, uid, phone);
  }

  const dashboardApplication = asRecord(dashboard.data?.application);
  if (!Object.keys(application).length && applicationMatchesCurrentUser(dashboardApplication, uid, phone)) {
    application = dashboardApplication;
  }

  const hasApplication = Boolean(Object.keys(application).length || dashboard.data?.hasApplication || dashboard.data?.approvalState?.hasApplication);
  const status = dashboard.data?.approved
    ? "APPROVED"
    : normalizeApplicationStatus(application.status ?? scopedApplication.data?.status ?? statusFromDashboard(dashboard.data));

  if (isDebugBuild()) {
    console.log("[partner-route] resolved start state", {
      dashboardApproved: dashboard.data?.approved ?? null,
      dashboardStatus: dashboard.data?.applicationStatus ?? dashboard.data?.approvalState?.applicationStatus ?? null,
      kycStatus: dashboard.data?.kycStatus ?? dashboard.data?.approvalState?.kycStatus ?? null,
      applicationStatus: application.status ?? scopedApplication.data?.status ?? null,
      hasApplication,
      routeStatus: hasApplication ? status : "NOT_STARTED",
      dashboardError: dashboard.error?.message ?? null,
      applicationError: scopedApplication.error?.message ?? null,
    });
  }

  return {
    application,
    dashboard: dashboard.data,
    hasApplication,
    status: hasApplication ? status : "NOT_STARTED",
    message: messageFromApplication(application, dashboard.data),
  };
}
