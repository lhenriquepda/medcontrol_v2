import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.dosyapp.dosy',
  appName: 'Dosy',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    // v0.2.3.11 #0006 — silencia bridge `console.dir(call)` em debug builds.
    // Release builds já silenciam via BuildConfig.DEBUG=false. Reverter pra 'debug'
    // se precisar rastrear traffic JS↔Java de plugin específico.
    loggingBehavior: 'production'
  },
  plugins: {
    StatusBar: {
      style: 'light',
      backgroundColor: '#FFF4EC',
      overlaysWebView: false
    },
    Keyboard: {
      resizeOnFullScreen: true
    },
    SplashScreen: {
      launchShowDuration: 2500,
      backgroundColor: '#FFF4EC',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_dosy',
      iconColor: '#FF6B5B',
      sound: 'default'
    }
  }
}

export default config
