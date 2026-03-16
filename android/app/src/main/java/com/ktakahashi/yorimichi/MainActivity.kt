package com.ktakahashi.yorimichi

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    rewriteMemoIdToDeepLink(intent)
    super.onCreate(null)
  }

  override fun onNewIntent(intent: Intent) {
    rewriteMemoIdToDeepLink(intent)
    super.onNewIntent(intent)
  }

  /**
   * GeofenceTransitionReceiver が putExtra("memoId", ...) で渡した memoId を
   * yorimichi://open?memoId=xxx のディープリンクに変換し、intent.data にセットする。
   * これにより React Native の Linking がそのまま受け取れる。
   */
  private fun rewriteMemoIdToDeepLink(intent: Intent?) {
    val memoId = intent?.getStringExtra("memoId") ?: return
    if (memoId.isBlank()) return
    // 既にディープリンクが設定されている場合は上書きしない
    if (intent.data != null) return
    intent.data = Uri.parse("yorimichi://open?memoId=$memoId")
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "Yorimichi"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
