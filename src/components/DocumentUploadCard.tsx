import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Camera, FileCheck2, Upload } from "lucide-react-native";
import { colors } from "../theme/colors";
import { AppCard } from "./AppCard";
import { StatusChip } from "./StatusChip";

type Props = {
  title: string;
  description: string;
  selectedLabel?: string;
  uploaded?: boolean;
  onPick?: () => void;
};

export function DocumentUploadCard({ title, description, selectedLabel, uploaded, onPick }: Props) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.top}>
        <View style={styles.icon}>{uploaded ? <FileCheck2 size={20} color={colors.primary} /> : <Camera size={20} color={colors.primary} />}</View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
        <StatusChip label={uploaded ? "Uploaded" : selectedLabel ? "Selected" : "Pending"} tone={uploaded ? "green" : selectedLabel ? "amber" : "slate"} />
      </View>
      {selectedLabel ? <Text style={styles.fileLabel}>{selectedLabel}</Text> : null}
      <Pressable style={styles.pickButton} onPress={onPick}>
        <Upload size={16} color={colors.primary} />
        <Text style={styles.pickText}>{selectedLabel ? "Choose another file" : "Choose file"}</Text>
      </Pressable>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  top: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  description: {
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 19,
    fontSize: 12,
  },
  fileLabel: {
    marginTop: 12,
    color: colors.text,
    fontWeight: "700",
  },
  pickButton: {
    marginTop: 12,
    height: 42,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.tealMist,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pickText: {
    color: colors.primary,
    fontWeight: "900",
  },
});
