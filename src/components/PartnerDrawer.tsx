import { useNavigation } from "@react-navigation/native";
import { BellRing, CircleDollarSign, FileCheck2, LayoutDashboard, LogOut, MessageCircle, Settings, UserRound, Wallet, X } from "lucide-react-native";
import React from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthProvider";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";

type Navigation = {
  navigate: (name: keyof RootStackParamList | keyof MainTabParamList, params?: unknown) => void;
};

type Props = {
  visible: boolean;
  onClose: () => void;
};

const menuItems = [
  { label: "Overview", icon: LayoutDashboard, route: "Dashboard" },
  { label: "Conversations", icon: MessageCircle, route: "Chats" },
  { label: "Requests", icon: BellRing, route: "Requests" },
  { label: "Earnings", icon: CircleDollarSign, route: "Wallet" },
  { label: "Payouts", icon: Wallet, route: "Wallet" },
  { label: "My Profile", icon: UserRound, route: "Profile" },
  { label: "Safety & KYC", icon: FileCheck2, route: "ApplicationStatus" },
  { label: "Settings", icon: Settings, route: "Settings" },
] as const;

export function PartnerDrawer({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Navigation>();
  const { logout } = useAuth();

  const navigateTo = (route: string) => {
    onClose();
    navigation.navigate(route as keyof RootStackParamList & keyof MainTabParamList);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.scrim} onPress={onClose} />
        <View style={[styles.drawer, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 18 }]}>
          <View style={styles.topRow}>
            <View style={styles.brandRow}>
              <Image source={require("../../assets/yopartner-logo.png")} style={styles.logo} />
              <View>
                <Text style={styles.brand}>YoPartner</Text>
                <Text style={styles.workspace}>PARTNER WORKSPACE</Text>
              </View>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose} accessibilityLabel="Close menu">
              <X size={18} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.menu}>
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Pressable key={item.label} style={styles.menuItem} onPress={() => navigateTo(item.route)}>
                  <Icon size={18} color={colors.primary} />
                  <Text style={styles.menuText}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={styles.logout}
            onPress={() => {
              onClose();
              void logout();
            }}
          >
            <LogOut size={18} color={colors.danger} />
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: "row" },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(15, 23, 42, 0.28)" },
  drawer: {
    width: "82%",
    maxWidth: 340,
    backgroundColor: colors.background,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingHorizontal: 16,
  },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  logo: { width: 38, height: 38, borderRadius: 19 },
  brand: { color: colors.text, fontSize: 18, fontWeight: "900" },
  workspace: { color: colors.textMuted, fontSize: 11, fontWeight: "900", marginTop: 2 },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  menu: { marginTop: 22, gap: 7, flex: 1 },
  menuItem: {
    minHeight: 48,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuText: { color: colors.text, fontWeight: "900", fontSize: 14 },
  logout: {
    minHeight: 48,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.dangerSoft,
  },
  logoutText: { color: colors.danger, fontWeight: "900" },
});
