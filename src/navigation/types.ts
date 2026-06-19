export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  MainTabs: undefined;
  Onboarding: undefined;
  ApplicationStatus: undefined;
  ChatThread: { sessionId: string };
  IncomingCall: { requestId: string; kind: "AUDIO" | "VIDEO"; callerName?: string };
  Call: { sessionId: string; kind: "AUDIO" | "VIDEO" };
  Settings: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Chats: undefined;
  Requests: undefined;
  Wallet: undefined;
  Profile: undefined;
};
