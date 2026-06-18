import { StyleSheet } from "react-native";
import { colors } from "./colors";
import { radius } from "./radius";
import { shadows } from "./shadows";

export const cardShadow = shadows.card;

export const sharedStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
    ...shadows.card,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
});
