import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { AppButton } from "../components/AppButton";
import type { RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { shadows } from "../theme/shadows";

type Props = NativeStackScreenProps<RootStackParamList, "Splash">;

export function SplashScreen({ navigation }: Props) {
  useEffect(() => {
    const timer = setTimeout(() => navigation.replace("Login"), 900);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.screen}>
      <View style={styles.brandBlock}>
        <View style={styles.logoWrap}>
          <Image source={require("../../assets/yopartner-logo.png")} style={styles.logo} />
        </View>
        <Text style={styles.brand}>YoPartner Host</Text>
        <Text style={styles.copy}>Your partner workspace for safe, respectful conversations.</Text>
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Opening host workspace...</Text>
        </View>
      </View>
      <AppButton title="Continue" onPress={() => navigation.replace("Login")} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    justifyContent: "space-between",
  },
  brandBlock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: {
    width: 122,
    height: 122,
    borderRadius: 34,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.floating,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 28,
  },
  brand: {
    color: colors.text,
    fontSize: 31,
    fontWeight: "900",
  },
  copy: {
    marginTop: 10,
    color: colors.textMuted,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  loadingRow: {
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    color: colors.textMuted,
    fontWeight: "800",
  },
});
