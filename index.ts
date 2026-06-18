import { registerRootComponent } from 'expo';
import messaging from "@react-native-firebase/messaging";

import App from './App';
import { configureAndroidNotificationChannels, displayPartnerNotification } from "./src/utils/nativeNotifications";

void configureAndroidNotificationChannels().catch((error) => {
  console.warn("[notifications] channel setup failed", error);
});

messaging().setBackgroundMessageHandler(async (message) => {
  await configureAndroidNotificationChannels();
  await displayPartnerNotification(message);
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
