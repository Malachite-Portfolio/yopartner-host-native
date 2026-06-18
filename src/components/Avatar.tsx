import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

type Props = {
  uri?: string | null;
  name?: string | null;
  size?: number;
};

export function Avatar({ uri, name, size = 44 }: Props) {
  const letter = (name || "Y").trim().slice(0, 1).toUpperCase() || "Y";
  if (uri) {
    return <Image source={{ uri }} style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]} />;
  }
  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.letter, { fontSize: Math.max(14, size * 0.42) }]}>{letter}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primarySoft,
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  letter: {
    color: colors.white,
    fontWeight: "900",
  },
});
