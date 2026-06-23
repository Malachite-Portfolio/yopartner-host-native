package expo.modules.callnotification

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.math.abs

private const val CHANNEL_ID = "incoming-calls"
private const val CHANNEL_NAME = "Incoming calls"
private const val NOTIFICATION_TAG = "yopartner-incoming-call"
private const val AUTO_CLEAR_DELAY_MS = 45_000L

class CallNotificationModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val clearRunnables = mutableMapOf<String, Runnable>()

  override fun definition() = ModuleDefinition {
    Name("CallNotification")

    AsyncFunction("showIncomingCallNotification") { payload: Map<String, Any?> ->
      val context = appContext.reactContext?.applicationContext ?: return@AsyncFunction false
      val callId = stringValue(payload["callId"])
        ?: stringValue(payload["sessionId"])
        ?: stringValue(payload["requestId"])
        ?: return@AsyncFunction false
      val kind = stringValue(payload["kind"])?.uppercase()
        ?: stringValue(payload["serviceType"])?.uppercase()
        ?: return@AsyncFunction false
      if (kind != "AUDIO" && kind != "VIDEO") return@AsyncFunction false

      ensureIncomingCallChannel(context)
      if (!canPostNotifications(context)) return@AsyncFunction false

      val callerName = stringValue(payload["callerName"]) ?: "YoPartner member"
      val title = if (kind == "VIDEO") "Incoming video call" else "Incoming audio call"
      val body = "$callerName is calling on YoPartner"
      val notificationId = notificationId(callId)
      val icon = context.applicationInfo.icon
      val openIntent = pendingActivityIntent(context, callId, kind, "open", 0)
      val acceptIntent = pendingActivityIntent(context, callId, kind, "accept", 1)
      val declineIntent = pendingActivityIntent(context, callId, kind, "decline", 2)

      val notification = NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(icon)
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(NotificationCompat.BigTextStyle().bigText(body))
        .setCategory(NotificationCompat.CATEGORY_CALL)
        .setPriority(NotificationCompat.PRIORITY_MAX)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setOngoing(true)
        .setAutoCancel(true)
        .setTimeoutAfter(AUTO_CLEAR_DELAY_MS)
        .setVibrate(longArrayOf(0, 700, 350, 700, 350, 700))
        .setContentIntent(openIntent)
        .setFullScreenIntent(openIntent, true)
        .addAction(icon, "Reject", declineIntent)
        .addAction(icon, "Accept", acceptIntent)
        .build()

      NotificationManagerCompat.from(context).notify(NOTIFICATION_TAG, notificationId, notification)
      scheduleAutoClear(context, callId, notificationId)
      true
    }

    AsyncFunction("clearIncomingCallNotification") { callId: String ->
      val context = appContext.reactContext?.applicationContext ?: return@AsyncFunction false
      clearNotification(context, callId)
      true
    }

    AsyncFunction("clearAllIncomingCallNotifications") {
      val context = appContext.reactContext?.applicationContext ?: return@AsyncFunction false
      clearRunnables.values.forEach { mainHandler.removeCallbacks(it) }
      clearRunnables.clear()
      NotificationManagerCompat.from(context).cancelAll()
      true
    }

    OnDestroy {
      clearRunnables.values.forEach { mainHandler.removeCallbacks(it) }
      clearRunnables.clear()
    }
  }

  private fun ensureIncomingCallChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val existing = notificationManager.getNotificationChannel(CHANNEL_ID)
    if (existing != null) return

    val channel = NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH).apply {
      description = "Incoming YoPartner audio and video calls"
      lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
      enableVibration(true)
      vibrationPattern = longArrayOf(0, 700, 350, 700, 350, 700)
      setSound(
        Settings.System.DEFAULT_RINGTONE_URI,
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build(),
      )
      enableLights(true)
      lightColor = Color.rgb(15, 118, 110)
    }
    notificationManager.createNotificationChannel(channel)
  }

  private fun canPostNotifications(context: Context): Boolean {
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
      ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
  }

  private fun pendingActivityIntent(context: Context, callId: String, kind: String, action: String, requestSalt: Int): PendingIntent {
    val uri = Uri.parse("yopartnerhost://incoming-call/${kind.lowercase()}/${Uri.encode(callId)}?action=$action")
    val intent = Intent(Intent.ACTION_VIEW, uri).apply {
      setPackage(context.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or immutableFlag()
    return PendingIntent.getActivity(context, notificationId(callId) + requestSalt, intent, flags)
  }

  private fun scheduleAutoClear(context: Context, callId: String, notificationId: Int) {
    clearRunnables.remove(callId)?.let { mainHandler.removeCallbacks(it) }
    val runnable = Runnable {
      NotificationManagerCompat.from(context).cancel(NOTIFICATION_TAG, notificationId)
      clearRunnables.remove(callId)
    }
    clearRunnables[callId] = runnable
    mainHandler.postDelayed(runnable, AUTO_CLEAR_DELAY_MS)
  }

  private fun clearNotification(context: Context, callId: String) {
    clearRunnables.remove(callId)?.let { mainHandler.removeCallbacks(it) }
    NotificationManagerCompat.from(context).cancel(NOTIFICATION_TAG, notificationId(callId))
  }

  private fun notificationId(callId: String): Int {
    val hash = callId.hashCode()
    return if (hash == Int.MIN_VALUE) 1 else abs(hash).coerceAtLeast(1)
  }

  private fun immutableFlag(): Int {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
  }

  private fun stringValue(value: Any?): String? {
    return value?.toString()?.trim()?.takeIf { it.isNotEmpty() }
  }
}
