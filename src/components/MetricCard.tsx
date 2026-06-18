import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";
import { sharedStyles } from "../theme/styles";

export function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={[sharedStyles.card, styles.card]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: "47%",
    padding: 14,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
  },
  value: {
    marginTop: 7,
    color: colors.text,
    fontSize: 23,
    fontWeight: "800",
  },
});
