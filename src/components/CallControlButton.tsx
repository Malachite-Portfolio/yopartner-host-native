import React from "react";
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { colors } from "../theme/colors";

type Props = {
  label: string;
  active?: boolean;
  danger?: boolean;
  onPress: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
};

export function CallControlButton({ label, active, danger, onPress, children, style }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.button,
        active && styles.active,
        danger && styles.danger,
        style,
      ]}
    >
      {children}
      <Text style={[styles.label, (active || danger) && styles.lightLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 72,
    minHeight: 66,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 10,
  },
  active: {
    backgroundColor: colors.primary,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  label: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 11,
    fontWeight: "800",
  },
  lightLabel: {
    color: colors.white,
  },
});
