import React from "react";
import { RefreshControl, ScrollView, StyleProp, StyleSheet, useWindowDimensions, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/colors";

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: Array<"top" | "right" | "bottom" | "left">;
};

export function ScreenContainer({ children, scroll = true, refreshing = false, onRefresh, contentStyle, edges = ["bottom"] }: Props) {
  const { height, width } = useWindowDimensions();
  const compact = height < 700 || width < 360;
  const responsiveContent = [
    styles.content,
    compact && styles.compactContent,
    { paddingHorizontal: width < 360 ? 12 : 16 },
    contentStyle,
  ];

  if (!scroll) {
    return (
      <SafeAreaView style={styles.screen} edges={edges}>
        <View style={responsiveContent}>{children}</View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={responsiveContent}
        keyboardShouldPersistTaps="handled"
        alwaysBounceVertical={false}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  compactContent: {
    paddingTop: 12,
    paddingBottom: 18,
  },
});
