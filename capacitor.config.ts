import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.dosyapp.dosy',
  appName: 'Dosy',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
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
