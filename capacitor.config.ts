import type { CapacitorConfig } from '@capacitor/cli'

// v0.2.6.5 LiveReload (DEV ONLY): rodar `DOSY_LIVERELOAD=1 npx cap sync android`
// + `npm run dev -- --host 0.0.0.0` faz WebView Android (debug) fetcha JS do Vite
// dev server ao invés do bundle estático. Hot reload sem precisar de RUN no Studio.
// NUNCA shipar release com DOSY_LIVERELOAD=1 — verificar via env vazia no CI.
const LIVERELOAD = process.env.DOSY_LIVERELOAD === '1'

const config: CapacitorConfig = {
  appId: 'com.dosyapp.dosy',
  appName: 'Dosy',
  webDir: 'dist',
  server: LIVERELOAD ? {
    androidScheme: 'https',
    url: 'http://10.0.2.2:5173', // emulator host loopback
    cleartext: true,
  } : {
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
