# YoPartner Host Native

Native Android host app for YoPartner, built with Expo, React Native, and TypeScript.

## Current Scope

Milestone 1 foundation is implemented:

- Native splash/login screens
- Firebase phone OTP flow structure with `@react-native-firebase/auth`
- Secure token storage with `expo-secure-store`
- API client pointed at the existing backend
- Partner dashboard UI matching the current web style
- ONLINE / OFFLINE availability updates through existing backend presence endpoints
- Chat list/thread/send with polling
- Agora audio/video call screens using backend session token endpoint
- FCM token registration hook using existing `/api/notifications/fcm-tokens`
- KYC/profile and wallet read screens using existing APIs

Billing is not calculated in the app. Chat message charges and audio/video session billing remain backend-owned.

## Setup

1. Copy `.env.example` to `.env`.
2. Put the real Android Firebase file at `google-services.json`.
3. Install dependencies:

```bash
npm install
```

4. Type-check:

```bash
npm run typecheck
```

5. Run the Metro server:

```bash
npm start
```

## Development Build With Metro

Use this while developing. This build expects Metro to be running and is not meant for direct phone install testing.

```bash
npm run android
```

Or build only the Metro-backed debug APK:

```bash
npm run build:android:debug
```

Expected Metro-backed APK path:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Standalone Test APK

Use this for direct install on an Android phone without Metro. It uses debug signing for internal testing, but it embeds `index.android.bundle` and Android assets in the APK.

```bash
npm run build:android:standalone
```

Expected standalone APK path:

```text
android/app/build/outputs/apk/standaloneDebug/app-standalone-debug.apk
```

This APK keeps:

- App label: `YoPartner Host`
- Package name: `com.yopartner.host`
- Existing Firebase, FCM, Agora, and backend API code

## Release APK/AAB

Release builds also embed the JS bundle and do not require Metro. The current generated project signs release with the debug keystore only until a production upload keystore is configured.

```bash
npm run build:android:release-apk
npm run build:android:release-aab
```

Expected release paths:

```text
android/app/build/outputs/apk/release/app-release.apk
android/app/build/outputs/bundle/release/app-release.aab
```

## API Contracts Used

- `GET /api/partner/dashboard`
- `POST /api/partner/presence/online`
- `POST /api/partner/presence/heartbeat`
- `POST /api/partner/presence/offline`
- `GET /api/partner/requests`
- `POST /api/partner/requests/:id/accept`
- `POST /api/partner/requests/:id/decline`
- `GET /api/sessions`
- `GET /api/sessions/:id`
- `GET /api/sessions/:id/messages`
- `POST /api/sessions/:id/messages`
- `POST /api/sessions/:id/end`
- `GET /api/sessions/:id/agora-token`
- `POST /api/sessions/:id/mark-live`
- `POST /api/notifications/fcm-tokens`
- `GET /api/partner/profile`
- `GET /api/partner/profile/media`
- `GET /api/partner/earnings`
- `GET /api/partner/payouts/summary`
- `POST /api/partner/payouts/request`

## OTP Development Testing

Firebase can temporarily block a real device after repeated OTP requests. For repeat QA, configure test phone numbers in Firebase Console:

1. Open Firebase Console for the YoPartner Android app.
2. Go to Authentication > Sign-in method > Phone.
3. Add a test Indian phone number in E.164 format, for example `+919999999999`, with a fixed 6 digit code.
4. Use that number only for development/QA builds.

The app formats Indian numbers as `+91XXXXXXXXXX`, disables duplicate send taps while a request is running, starts a resend cooldown after each request, and does not retry OTP automatically.

## Notification Endpoint

The native app registers Android FCM tokens at:

```text
POST /api/notifications/fcm-tokens
```

Local backend code already contains this route and stores tokens in `FcmDeviceToken`. If a phone build shows notification setup pending and a deploy probe returns 404 for this route, deploy the backend that includes `src/routes/notifications.routes.ts` and run the `20260615_partner_fcm_device_tokens` Prisma migration on Railway.

## Known V1 Gaps

- KYC native upload is not wired yet. The screen shows existing status only.
- FCM notifications need real-device QA after `google-services.json` is added.
- Agora calls need real-device QA with approved live sessions.
- Withdrawal request UI is intentionally read-only until bank detail QA is completed.
