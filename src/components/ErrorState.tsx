import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { AlertCircle } from "lucide-react-native";
import { colors } from "../theme/colors";
import { AppButton } from "./AppButton";

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.wrap}>
      <AlertCircle size={18} color={colors.danger} />
      <Text style={styles.message}>{message}</Text>
      {onRetry ? <AppButton title="Retry" variant="secondary" onPress={onRetry} style={styles.button} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#fecdd3",
    backgroundColor: colors.dangerSoft,
    padding: 14,
    alignItems: "flex-start",
    gap: 8,
  },
  message: {
    color: "#be123c",
    lineHeight: 20,
    fontWeight: "700",
  },
  button: {
    minHeight: 38,
  },
});
