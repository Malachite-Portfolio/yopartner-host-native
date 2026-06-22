import { Bell, Menu, ShieldCheck } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { PartnerDrawer } from "./PartnerDrawer";

export function ScreenHeader({ title }: { title: string }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const insets = useSafeAreaInsets();
  return (
    <>
      <View style={[styles.header, { paddingTop: insets.top, minHeight: 72 + insets.top }]}>
        <View style={styles.left}>
          <Pressable style={styles.iconButton} accessibilityLabel="Open menu" onPress={() => setDrawerOpen(true)}>
            <Menu size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.actions}>
          <Pressable style={styles.iconButton} accessibilityLabel="Notifications">
            <Bell size={17} color={colors.text} />
          </Pressable>
          <View style={styles.profilePill}>
            <View style={styles.badge}>
              <ShieldCheck size={14} color={colors.primary} />
            </View>
            <View style={styles.avatar} accessibilityLabel="YoPartner">
              <Text style={styles.avatarText}>Y</Text>
            </View>
          </View>
        </View>
      </View>
      <PartnerDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 72,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: "rgba(255,253,248,0.96)",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "800",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  profilePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingLeft: 5,
    paddingRight: 3,
    height: 40,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.white, fontSize: 16, fontWeight: "900" },
});
