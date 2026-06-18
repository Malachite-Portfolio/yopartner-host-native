import { Lock, WalletCards } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { getPartnerEarnings, getPartnerPayoutSummary } from "../api/partner";
import { AppButton } from "../components/AppButton";
import { AppCard } from "../components/AppCard";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionHeader } from "../components/SectionHeader";
import { colors } from "../theme/colors";
import { sharedStyles } from "../theme/styles";
import { formatINR } from "../utils/format";

export function WalletScreen() {
  const [earnings, setEarnings] = useState<Record<string, unknown>[]>([]);
  const [payouts, setPayouts] = useState<Record<string, unknown>[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [earningsResponse, payoutResponse] = await Promise.all([getPartnerEarnings(), getPartnerPayoutSummary()]);
    if (earningsResponse.data) {
      setEarnings(earningsResponse.data.earnings ?? []);
      setPayouts(earningsResponse.data.payouts ?? []);
      setSummary({ ...(earningsResponse.data.summary ?? {}), ...(payoutResponse.data?.summary ?? {}) });
      setError("");
    } else if (earningsResponse.error) {
      setError(earningsResponse.error.message);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => [
    ["Total Earnings", summary.totalEarnings ?? summary.earnedAvailableAmount ?? 0],
    ["Session Earnings", summary.sessionEarnings ?? 0],
    ["Gift Earnings", summary.giftEarnings ?? 0],
    ["Available to Withdraw", summary.availableBalance ?? summary.availableToWithdraw ?? 0],
    ["Pending", summary.pendingAmount ?? summary.pendingPayoutAmount ?? 0],
    ["Paid", summary.paidAmount ?? summary.totalPaidAmount ?? 0],
  ], [summary]);

  return (
    <View style={sharedStyles.screen}>
      <ScreenHeader title="Earnings" />
      <ScrollView
        contentContainerStyle={sharedStyles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        {loading ? <LoadingState label="Loading earnings..." /> : null}
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
        <AppCard style={styles.balanceCard}>
          <View style={styles.balanceTop}>
            <View style={styles.balanceIcon}><WalletCards size={22} color={colors.primary} /></View>
          <Text style={styles.balanceLabel}>Available to withdraw</Text>
        </View>
        <Text style={styles.balance}>{formatINR(Number(summary.availableBalance ?? summary.availableToWithdraw ?? 0))}</Text>
          <AppButton title="Request payout" variant="secondary" disabled onPress={() => undefined} style={{ marginTop: 14 }} />
          <Text style={styles.copy}>Bank details are verified by admin before payout processing.</Text>
        </AppCard>
        <View style={styles.grid}>
          {rows.map(([label, value]) => (
            <View key={String(label)} style={[sharedStyles.card, styles.tile]}>
              <Text style={styles.tileLabel}>{String(label)}</Text>
              <Text style={styles.tileValue}>{formatINR(Number(value))}</Text>
            </View>
          ))}
        </View>
        <AppCard style={styles.section}>
          <SectionHeader title="Earnings History" caption="Backend remains the source of truth for earnings and payouts." />
          {earnings.length === 0 ? <EmptyState title="No earning entries yet" message="Completed paid sessions will appear here after backend settlement." /> : null}
          {earnings.slice(0, 20).map((item, index) => (
            <View key={String(item.id ?? index)} style={styles.ledgerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ledgerTitle}>{String(item.source ?? item.sourceType ?? "Earning")}</Text>
                <Text style={styles.ledgerMeta}>{String(item.status ?? "")}</Text>
              </View>
              <Text style={styles.ledgerAmount}>{formatINR(Number(item.myEarnings ?? item.partnerAmount ?? 0))}</Text>
            </View>
          ))}
        </AppCard>
        <AppCard style={styles.section}>
          <SectionHeader title="Payouts" caption="Pending payouts, total paid, and request history." />
          <View style={styles.payoutSummary}>
            <View style={styles.payoutTile}>
              <Text style={styles.tileLabel}>Pending payouts</Text>
              <Text style={styles.tileValue}>{formatINR(Number(summary.pendingPayoutAmount ?? 0))}</Text>
            </View>
            <View style={styles.payoutTile}>
              <Text style={styles.tileLabel}>Total paid</Text>
              <Text style={styles.tileValue}>{formatINR(Number(summary.totalPaidAmount ?? 0))}</Text>
            </View>
          </View>
          <Text style={styles.copy}>Bank details: {String((summary.bankDetails as Record<string, unknown> | undefined)?.note ?? "Admin may verify payout details before processing.")}</Text>
          {payouts.length === 0 ? <EmptyState title="No payout history yet" message="Payout requests and payment history will appear here." /> : null}
          {payouts.slice(0, 20).map((item, index) => (
            <View key={String(item.id ?? index)} style={styles.ledgerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ledgerTitle}>{String(item.payoutCode ?? "Payout request")}</Text>
                <Text style={styles.ledgerMeta}>{String(item.status ?? "")}</Text>
              </View>
              <Text style={styles.ledgerAmount}>{formatINR(Number(item.amount ?? 0))}</Text>
            </View>
          ))}
        </AppCard>
        <View style={styles.lockNote}>
          <Lock size={14} color={colors.textMuted} />
          <Text style={styles.lockText}>No wallet or billing calculations happen inside the app.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  balanceCard: { marginBottom: 12 },
  balanceTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  balanceIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  balanceLabel: { color: colors.textMuted, fontWeight: "700" },
  balance: { color: colors.text, fontSize: 34, fontWeight: "900", marginTop: 6 },
  copy: { color: colors.textMuted, lineHeight: 20, marginTop: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  tile: { minWidth: "47%", flex: 1, padding: 13 },
  tileLabel: { color: colors.textMuted, fontSize: 12 },
  tileValue: { color: colors.text, fontWeight: "900", marginTop: 6, fontSize: 18 },
  section: { marginBottom: 14 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
  ledgerRow: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 12 },
  ledgerTitle: { color: colors.text, fontWeight: "800" },
  ledgerMeta: { color: colors.textMuted, marginTop: 3, fontSize: 12 },
  ledgerAmount: { color: colors.primary, fontWeight: "900" },
  payoutSummary: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  payoutTile: { flex: 1, minWidth: "47%", borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted, padding: 12 },
  error: { color: colors.danger, marginBottom: 12 },
  lockNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 2 },
  lockText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
});
