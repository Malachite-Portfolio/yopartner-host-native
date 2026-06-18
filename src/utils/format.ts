export function formatINR(value?: number | null) {
  const numeric = Number(value ?? 0);
  const safe = Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
  return `Rs ${safe.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function maskPhone(value?: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length >= 4) return `+91******${digits.slice(-4)}`;
  return value?.trim() || "Member";
}

export function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
