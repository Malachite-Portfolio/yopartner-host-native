export type AvailabilityStatus = "ONLINE" | "BUSY" | "OFFLINE";
export type SessionKind = "CHAT" | "AUDIO" | "VIDEO";

export type ApiError = {
  status?: number;
  code?: string;
  message: string;
  details?: unknown;
};

export type ApiResult<T> = {
  data: T | null;
  error: ApiError | null;
  status?: number;
};

export type PartnerIncomingRequest = {
  id: string;
  type: SessionKind;
  memberLabel?: string;
  memberName?: string;
  memberPhoneMasked?: string;
  expectedRate?: number;
  createdAt?: string;
};

export type PartnerActiveSession = PartnerIncomingRequest & {
  status?: string;
  startedAt?: string | null;
};

export type PartnerDashboardPayload = {
  approvalState?: Record<string, unknown>;
  debugIdentity?: Record<string, unknown>;
  approved?: boolean;
  hasApplication?: boolean;
  applicationStatus?: PartnerApplicationStatus;
  companionStatus?: string;
  verificationStatus?: string;
  kycStatus?: string;
  application?: Record<string, unknown> | null;
  message?: string;
  stats?: {
    peopleSupportedToday?: number;
    audioConversations?: number;
    videoConversations?: number;
    pendingRequests?: number;
    earningsToday?: number;
    averageRating?: number;
  };
  pendingRequests?: PartnerIncomingRequest[];
  activeSessions?: PartnerActiveSession[];
  companion?: Record<string, unknown> | null;
  availability?: {
    isOnline?: boolean;
    rawIsOnline?: boolean;
    isBusy?: boolean;
    effectiveStatus?: AvailabilityStatus;
  } | null;
};

export type SessionRecord = {
  id: string;
  sessionCode?: string;
  channelName?: string;
  serviceType?: SessionKind;
  type?: SessionKind;
  status?: string;
  acceptedAt?: string | null;
  startedAt?: string | null;
  liveStartedAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number;
  updatedAt?: string;
  createdAt?: string;
  lastMessage?: string;
  unreadCount?: number;
  user?: {
    name?: string | null;
    fullName?: string | null;
    phoneMasked?: string | null;
    phoneNumber?: string | null;
  } | null;
  companion?: Record<string, unknown> | null;
};

export type SessionMessage = {
  id: string;
  sessionId: string;
  senderRole?: "USER" | "PARTNER" | "UNKNOWN";
  text?: string;
  body: string;
  createdAt: string;
  isMine?: boolean;
};

export type PartnerApplicationStatus =
  | "NOT_STARTED"
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "NEEDS_INFO"
  | "UNDER_REVIEW"
  | string;

export type PartnerApplicationsPayload = {
  application?: Record<string, unknown> | null;
  applications?: Record<string, unknown>[];
  status?: PartnerApplicationStatus;
};

export type AgoraTokenPayload = {
  appId: string;
  token: string;
  channelName: string;
  uid: number | string;
  expiresAt?: number;
};
