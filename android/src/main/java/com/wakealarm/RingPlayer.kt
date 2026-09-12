package com.wakealarm

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.PowerManager

class RingPlayer(private val context: Context) {
  private var player: MediaPlayer? = null
  private var retried = false

  /** Starts looping playback on the ALARM stream. Returns false only if even the system default could not start. */
  fun start(sound: String): Boolean {
    stop()
    val uri = resolve(sound) ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM) ?: return false
    return startUri(uri, fallbackOnError = true)
  }

  fun stop() {
    player?.let { p -> runCatching { if (p.isPlaying) p.stop() }; runCatching { p.release() } }
    player = null
  }

  private fun startUri(uri: Uri, fallbackOnError: Boolean): Boolean = try {
    val p = MediaPlayer()
    p.setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
    p.setDataSource(context, uri)
    p.isLooping = true
    p.setWakeMode(context, PowerManager.PARTIAL_WAKE_LOCK)
    p.setOnPreparedListener { runCatching { it.start() } }
    p.setOnErrorListener { _, _, _ ->
      if (fallbackOnError && !retried) {
        retried = true
        stop()
        RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)?.let { startUri(it, fallbackOnError = false) }
      }
      true
    }
    p.prepareAsync()
    player = p
    true
  } catch (_: Throwable) {
    if (fallbackOnError && !retried) {
      retried = true
      RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)?.let { startUri(it, fallbackOnError = false) } ?: false
    } else false
  }

  private fun resolve(sound: String): Uri? {
    if (sound.isBlank()) return null
    val id = context.resources.getIdentifier(sound, "raw", context.packageName)
    return if (id == 0) null else Uri.parse("android.resource://${context.packageName}/$id")
  }
}
