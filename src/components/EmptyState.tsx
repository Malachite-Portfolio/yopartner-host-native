import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Inbox } from "lucide-react-native";
import { colors } from "../theme/colors";

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.icon}>
        <Inbox size={22} color={colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: 26,
    paddingHorizontal: 12,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 16,
  },
  message: {
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
});
