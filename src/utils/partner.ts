import type { AvailabilityStatus, PartnerDashboardPayload, PartnerIncomingRequest, SessionRecord } from "../types/api";

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getSessionKind(session: SessionRecord) {
  return session.serviceType ?? session.type ?? "CHAT";
}

export function getSessionMemberLabel(session: SessionRecord) {
  return session.user?.name || session.user?.fullName || session.user?.phoneMasked || session.user?.phoneNumber || "Member";
}

export function getRequestMemberLabel(request: PartnerIncomingRequest) {
  return request.memberName || request.memberPhoneMasked || request.memberLabel || "Member";
}

export function getAvailabilityStatus(dashboard: PartnerDashboardPayload | null): AvailabilityStatus {
  return dashboard?.availability?.effectiveStatus ?? "OFFLINE";
}

export function isRawOnline(dashboard: PartnerDashboardPayload | null) {
  return Boolean(dashboard?.availability?.rawIsOnline ?? dashboard?.availability?.isOnline);
}

function normalizeStatus(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function statusLabel(value: unknown, fallback: string) {
  const normalized = normalizeStatus(value);
  if (!normalized) return fallback;
  if (normalized === "APPROVED") return "Approved";
  if (normalized === "UNDER_REVIEW" || normalized === "PENDING") return "Under Review";
  if (normalized === "NEEDS_INFO") return "Needs Info";
  if (normalized === "REJECTED" || normalized === "FAILED") return "Rejected";
  if (normalized === "NOT_STARTED" || normalized === "NOT_SUBMITTED") return "Not Started";
  if (normalized === "DRAFT") return "Draft";
  if (normalized === "VERIFIED" || normalized === "COMPLETE") return "KYC Verified";
  return normalized
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getApprovalState(dashboard: PartnerDashboardPayload | null) {
  const state = asRecord(dashboard?.approvalState);
  const approved = dashboard?.approved === true || normalizeStatus(state.applicationStatus) === "APPROVED";
  const kycStatus = normalizeStatus(state.kycStatus ?? state.verificationStatus);
  const verified = kycStatus === "VERIFIED" || kycStatus === "COMPLETE";
  return {
    kyc: verified || approved ? "KYC Verified" : statusLabel(state.kycStatus ?? state.verificationStatus, "KYC Pending"),
    review: approved ? "Approved" : statusLabel(state.reviewStatus ?? state.applicationStatus, "Under Review"),
    application: statusLabel(state.applicationStatus, "Under Review"),
  };
}

export function isApproved(dashboard: PartnerDashboardPayload | null) {
  if (!dashboard) return false;
  if (dashboard.approved === true) return true;
  const labels = getApprovalState(dashboard);
  return labels.review.toUpperCase() === "APPROVED";
}
