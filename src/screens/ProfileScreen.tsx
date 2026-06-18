import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Camera, FileCheck2, Settings } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { getPartnerDashboard, getPartnerProfile, getPartnerProfileMedia } from "../api/partner";
import { AppButton } from "../components/AppButton";
import { AppCard } from "../components/AppCard";
import { Avatar } from "../components/Avatar";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionHeader } from "../components/SectionHeader";
import { StatusChip } from "../components/StatusChip";
import type { RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { sharedStyles } from "../theme/styles";
import { asRecord, getApprovalState } from "../utils/partner";

type RootNav = NativeStackNavigationProp<RootStackParamList>;

export function ProfileScreen() {
  const navigation = useNavigation<RootNav>();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [gallery, setGallery] = useState<{ imageUrl: string; storagePath: string }[]>([]);
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [profileResponse, mediaResponse, dashboardResponse] = await Promise.all([
      getPartnerProfile(),
      getPartnerProfileMedia(),
      getPartnerDashboard(),
    ]);
    setProfile(profileResponse.data);
    setMediaUrl(mediaResponse.data?.resolvedProfileImageUrl || mediaResponse.data?.profileImageUrl || null);
    setGallery(mediaResponse.data?.galleryImages ?? []);
    setDashboard(dashboardResponse.data?.approvalState ?? null);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const companion = asRecord(profile?.companion);
  const application = asRecord(profile?.application);
  const name = String(application.fullName ?? companion.displayName ?? "YoPartner Partner");
  const languages = Array.isArray(application.languagesKnown) ? application.languagesKnown : Array.isArray(companion.languages) ? companion.languages : [];
  const services = Array.isArray(application.servicesOffered) ? application.servicesOffered : Array.isArray(companion.servicesOffered) ? companion.servicesOffered : [];
  const labels = getApprovalState({ approvalState: dashboard ?? undefined, approved: String(dashboard?.applicationStatus).toUpperCase() === "APPROVED" });

  return (
    <View style={sharedStyles.screen}>
      <ScreenHeader title="My Profile" />
      <ScrollView
        contentContainerStyle={sharedStyles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        {loading ? <LoadingState label="Loading profile..." /> : null}
        <AppCard style={styles.profile}>
          <Avatar uri={mediaUrl} name={name} size={92} />
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.tagline}>{String(application.profileTagline ?? companion.tagline ?? "Verified YoPartner host profile")}</Text>
          <View style={styles.chips}>
            <StatusChip label={labels.kyc} tone={labels.kyc.includes("Verified") ? "green" : "amber"} />
            <StatusChip label={labels.review} tone={labels.review === "Approved" ? "green" : "amber"} />
          </View>
          <View style={styles.profileActions}>
            <AppButton title="KYC flow" variant="secondary" onPress={() => navigation.navigate("Onboarding")} style={styles.profileButton} />
            <AppButton title="Settings" variant="secondary" onPress={() => navigation.navigate("Settings")} style={styles.profileButton} />
          </View>
        </AppCard>

        <AppCard style={styles.section}>
          <SectionHeader title="About" />
          <Text style={styles.copy}>{String(application.aboutYourself ?? companion.about ?? "Profile details will appear here after onboarding review.")}</Text>
          <View style={styles.chipWrap}>
            {languages.slice(0, 8).map((item) => <StatusChip key={String(item)} label={String(item)} tone="slate" />)}
            {services.slice(0, 8).map((item) => <StatusChip key={String(item)} label={String(item).replace(/_/g, " ")} tone="green" />)}
          </View>
        </AppCard>

        <AppCard style={styles.section}>
          <SectionHeader title="KYC documents" caption="Selfie and Aadhaar verification documents are required." />
          <Text style={styles.copy}>Required for this native V1: selfie, Aadhaar front, Aadhaar back.</Text>
          <View style={styles.docRow}><FileCheck2 size={16} color={colors.primary} /><Text style={styles.doc}>Selfie</Text><StatusChip label={application.selfieUploaded ? "Uploaded" : "Pending"} tone={application.selfieUploaded ? "green" : "amber"} /></View>
          <View style={styles.docRow}><FileCheck2 size={16} color={colors.primary} /><Text style={styles.doc}>Aadhaar front</Text><StatusChip label={application.aadhaarFrontUploaded ? "Uploaded" : "Pending"} tone={application.aadhaarFrontUploaded ? "green" : "amber"} /></View>
          <View style={styles.docRow}><FileCheck2 size={16} color={colors.primary} /><Text style={styles.doc}>Aadhaar back</Text><StatusChip label={application.aadhaarBackUploaded ? "Uploaded" : "Pending"} tone={application.aadhaarBackUploaded ? "green" : "amber"} /></View>
        </AppCard>

        <AppCard style={styles.section}>
          <View style={styles.galleryHeader}>
            <SectionHeader title="Public Profile Photos" caption="Profile picture and public gallery photos shown to members." />
            <Pressable style={styles.settingsIcon} onPress={() => navigation.navigate("Settings")}><Settings size={17} color={colors.primary} /></Pressable>
          </View>
          <View style={styles.photoCard}>
            <Avatar uri={mediaUrl} name={name} size={64} />
            <View style={{ flex: 1 }}>
              <Text style={styles.photoTitle}>Profile picture</Text>
              <Text style={styles.copy}>Gallery {gallery.length}/6</Text>
            </View>
            <Pressable style={styles.addPhotoButton} onPress={() => navigation.navigate("Settings")}>
              <Camera size={16} color={colors.primary} />
              <Text style={styles.addPhotoText}>Add photo</Text>
            </Pressable>
          </View>
          {gallery.length === 0 ? <EmptyState title="No gallery images" message="Gallery previews will appear here after profile media is uploaded." /> : null}
          <View style={styles.galleryGrid}>
            {gallery.slice(0, 6).map((item) => <Image key={item.storagePath || item.imageUrl} source={{ uri: item.imageUrl }} style={styles.galleryImage} />)}
          </View>
        </AppCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  profile: { alignItems: "center", marginBottom: 14 },
  profileActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  profileButton: { flex: 1, minHeight: 42 },
  name: { color: colors.text, fontSize: 22, fontWeight: "900" },
  tagline: { color: colors.textMuted, marginTop: 6, textAlign: "center", lineHeight: 21 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  section: { marginBottom: 14 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "900", marginBottom: 8 },
  copy: { color: colors.textMuted, lineHeight: 20, marginBottom: 8 },
  docRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 10, flexDirection: "row", gap: 8, justifyContent: "space-between", alignItems: "center" },
  doc: { color: colors.text, fontWeight: "800", flex: 1 },
  galleryHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  settingsIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  photoCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted, padding: 12, marginBottom: 12 },
  photoTitle: { color: colors.text, fontWeight: "900" },
  addPhotoButton: { minHeight: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  addPhotoText: { color: colors.primary, fontWeight: "900", fontSize: 12 },
  galleryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  galleryImage: { width: "31%", aspectRatio: 1, borderRadius: 16, backgroundColor: colors.slateSoft },
});
