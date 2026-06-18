import storage from "@react-native-firebase/storage";
import { getCurrentFirebaseUser } from "../auth/firebasePhone";

export type PartnerKycUploadType = "selfie" | "aadhaar-front" | "aadhaar-back" | "live-video";

export type NativeKycFile = {
  uri: string;
  fileName: string;
  contentType: string;
  fileSize?: number;
};

export type PartnerKycUploadResult = {
  uploaded: true;
  fileName: string;
  storagePath: string;
  downloadUrl?: string;
  contentType: string;
  size: number;
};

const MAX_DOCUMENT_FILE_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4"]);

function sanitizeFileName(name: string) {
  const trimmed = name.trim();
  const dotIndex = trimmed.lastIndexOf(".");
  const base = dotIndex > 0 ? trimmed.slice(0, dotIndex) : trimmed;
  const ext = dotIndex > 0 ? trimmed.slice(dotIndex).toLowerCase() : "";
  const safeBase = base
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");
  return `${safeBase || "document"}${ext}`;
}

function validateFile(file: NativeKycFile, type: PartnerKycUploadType) {
  const size = file.fileSize ?? 0;
  if (type === "live-video") {
    if (!ALLOWED_VIDEO_TYPES.has(file.contentType)) {
      throw new Error("Live verification video must be MP4.");
    }
    if (size > MAX_VIDEO_FILE_SIZE) {
      throw new Error("Live verification video must be 50 MB or smaller.");
    }
    return;
  }

  if (!ALLOWED_DOCUMENT_TYPES.has(file.contentType)) {
    throw new Error("Only JPG, PNG, WEBP, or PDF files are allowed.");
  }
  if (size > MAX_DOCUMENT_FILE_SIZE) {
    throw new Error("Each verification document must be 5 MB or smaller.");
  }
}

function toPutFileUri(uri: string) {
  if (uri.startsWith("file://")) {
    return decodeURIComponent(uri.replace("file://", ""));
  }
  return uri;
}

function toFriendlyUploadError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const message = error instanceof Error ? error.message : "";
  console.warn("[partner-kyc-upload] native upload failed", { code, message });
  return new Error("Upload failed. Please try again.");
}

export async function uploadPartnerKycFile(file: NativeKycFile, type: PartnerKycUploadType): Promise<PartnerKycUploadResult> {
  const user = getCurrentFirebaseUser();
  const uid = user?.uid?.trim();
  if (!user || !uid) {
    throw new Error("Please login again as a partner before uploading.");
  }

  try {
    validateFile(file, type);
    const cleanName = sanitizeFileName(file.fileName || "document");
    const storagePath = `YoPartner/partner-kyc/${uid}/${type}/${Date.now()}-${cleanName}`;
    const reference = storage().ref(storagePath);
    const localFileUri = toPutFileUri(file.uri);

    await user.getIdToken(true);
    await reference.putFile(localFileUri, {
      contentType: file.contentType,
      customMetadata: {
        ownerUid: uid,
        documentType: type,
      },
    });

    let downloadUrl: string | undefined;
    try {
      downloadUrl = await reference.getDownloadURL();
    } catch (error) {
      console.warn("[partner-kyc-upload] download URL unavailable", error);
    }

    return {
      uploaded: true,
      fileName: cleanName,
      storagePath,
      downloadUrl,
      contentType: file.contentType,
      size: file.fileSize ?? 0,
    };
  } catch (error) {
    throw toFriendlyUploadError(error);
  }
}
