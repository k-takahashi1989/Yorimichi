package com.ktakahashi.yorimichi

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.google.android.gms.maps.MapsInitializer
import com.google.android.gms.maps.MapsInitializer.Renderer

class YorimichiApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // ネイティブジオフェンスモジュールを登録
          add(GeofencePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // Google Maps の LEGACY レンダラーを指定（LATEST だと React Native で黒画面になる場合がある）
    MapsInitializer.initialize(applicationContext, Renderer.LEGACY, null)
    loadReactNative(this)
  }
}
