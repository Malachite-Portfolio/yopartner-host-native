package expo.modules.callringtone

import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val TAG = "CallRingtone"
private const val AUTO_STOP_DELAY_MS = 45_000L

class CallRingtoneModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private var ringtone: Ringtone? = null
  private val autoStopRunnable = Runnable { stopOnMainThread() }
  private val ensurePlayingRunnable = object : Runnable {
    override fun run() {
      val currentRingtone = ringtone ?: return
      try {
        if (!currentRingtone.isPlaying) currentRingtone.play()
      } catch (_: Throwable) {
        Log.w(TAG, "Call ringtone unavailable")
        stopOnMainThread()
        return
      }
      mainHandler.postDelayed(this, 1_000L)
    }
  }

  override fun definition() = ModuleDefinition {
    Name("CallRingtone")

    AsyncFunction("start") {
      mainHandler.post { startOnMainThread() }
      Unit
    }

    AsyncFunction("stop") {
      stopSafely()
    }

    Function("isPlaying") {
      runCatching { ringtone?.isPlaying == true }.getOrDefault(false)
    }

    OnDestroy {
      stopSafely()
    }
  }

  private fun startOnMainThread() {
    stopOnMainThread()
    val context = appContext.reactContext?.applicationContext
    if (context == null) {
      Log.w(TAG, "Call ringtone unavailable")
      return
    }

    runCatching {
      val ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        ?: Settings.System.DEFAULT_RINGTONE_URI
      val nextRingtone = RingtoneManager.getRingtone(context, ringtoneUri)
      if (nextRingtone == null) {
        Log.w(TAG, "Call ringtone unavailable")
        return
      }
      ringtone = nextRingtone
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        nextRingtone.isLooping = true
      }
      nextRingtone.play()
      mainHandler.postDelayed(ensurePlayingRunnable, 1_000L)
      mainHandler.postDelayed(autoStopRunnable, AUTO_STOP_DELAY_MS)
      Log.i(TAG, "Call ringtone started")
    }.onFailure {
      ringtone = null
      Log.w(TAG, "Call ringtone unavailable")
    }
  }

  private fun stopSafely() {
    if (Looper.myLooper() == Looper.getMainLooper()) {
      stopOnMainThread()
    } else {
      mainHandler.post { stopOnMainThread() }
    }
  }

  private fun stopOnMainThread() {
    mainHandler.removeCallbacks(autoStopRunnable)
    mainHandler.removeCallbacks(ensurePlayingRunnable)
    val currentRingtone = ringtone
    ringtone = null
    if (currentRingtone != null) {
      runCatching { currentRingtone.stop() }
      Log.i(TAG, "Call ringtone stopped")
    }
  }
}
