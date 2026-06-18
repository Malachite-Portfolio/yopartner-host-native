import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

export function SectionHeader({ title, caption }: { title: string; caption?: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 10,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
  },
  caption: {
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 19,
  },
});
