import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

export type SegmentOption<T extends string> = {
  label: string;
  value: T;
  disabled?: boolean;
};

type Props<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.wrap}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            disabled={option.disabled}
            style={[styles.segment, selected && styles.selected, option.disabled && styles.disabled]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.text, selected && styles.selectedText]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    borderRadius: 18,
    padding: 4,
    backgroundColor: colors.slateSoft,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  selected: {
    backgroundColor: colors.primary,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: colors.textMuted,
    fontWeight: "900",
    fontSize: 12,
  },
  selectedText: {
    color: colors.white,
  },
});
