import auth from "@react-native-firebase/auth";

export async function sendPhoneOtp(phoneNumber: string) {
  return auth().signInWithPhoneNumber(phoneNumber);
}

export async function getCurrentIdToken(forceRefresh = false) {
  const current = auth().currentUser;
  if (!current) return null;
  return current.getIdToken(forceRefresh);
}

export function getCurrentFirebaseUser() {
  return auth().currentUser;
}

export async function signOutFirebase() {
  await auth().signOut();
}
