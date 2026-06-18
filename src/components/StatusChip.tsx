import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

type Tone = "green" | "amber" | "slate" | "rose";

const toneMap: Record<Tone, { bg: string; fg: string }> = {
  green: { bg: "#ecfdf5", fg: "#047857" },
  amber: { bg: "#fffbeb", fg: "#b45309" },
  slate: { bg: "#f1f5f9", fg: "#475569" },
  rose: { bg: "#fff1f2", fg: "#be123c" },
};

export function StatusChip({ label, tone = "slate" }: { label: string; tone?: Tone }) {
  const selected = toneMap[tone];
  return (
    <View style={[styles.chip, { backgroundColor: selected.bg, borderColor: tone === "slate" ? colors.border : selected.bg }]}>
      <Text style={[styles.text, { color: selected.fg }]} numberOfLines={2}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexShrink: 1,
  },
  text: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
});
