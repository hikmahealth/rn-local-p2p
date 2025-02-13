package com.rnlocalp2p

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = RnLocalP2pModule.NAME)
class RnLocalP2pModule(reactContext: ReactApplicationContext) :
  NativeRnLocalP2pSpec(reactContext) {

  override fun getName(): String {
    return NAME
  }

  // Example method
  // See https://reactnative.dev/docs/native-modules-android
  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = "RnLocalP2p"
  }
}
