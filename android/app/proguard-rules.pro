# Dosy ProGuard / R8 rules — release build com minifyEnabled+shrinkResources.
# Auditoria 4.5.4 G1 (P0).
#
# Estratégia: keep rules específicas pra Capacitor plugins, Sentry, Supabase, custom plugin
# CriticalAlarm (Java reflection via Capacitor bridge), e WebView JS interfaces.

# Preservar info de linha para Sentry stack traces decoded
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# === Capacitor core + plugins ===
# Capacitor usa reflection pra registrar plugins via @CapacitorPlugin
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod <methods>;
}

# === Custom plugin: CriticalAlarm ===
# Plugin Java + Activity/Receiver/Service registrados em AndroidManifest
-keep class com.dosyapp.dosy.plugins.criticalalarm.** { *; }
-keep class com.dosyapp.dosy.MainActivity { *; }

# === Capacitor community plugins ===
-keep class com.getcapacitor.community.** { *; }
-keep class com.aparajita.capacitor.securestorage.** { *; }
-keep class com.capacitorjs.plugins.** { *; }

# === Sentry ===
-keep class io.sentry.** { *; }
-dontwarn io.sentry.**

# === Firebase / FCM ===
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# === Android Support / WebView ===
-keep class androidx.** { *; }
-keep class * extends androidx.fragment.app.Fragment { *; }

# WebView JS interface — caso algum plugin exponha
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# === JSON / Gson (usado pelo Capacitor) ===
-keep class org.json.** { *; }
-keepattributes Signature
-keepattributes *Annotation*

# === Suprimir warnings inofensivos ===
-dontwarn org.codehaus.mojo.animal_sniffer.**
-dontwarn javax.annotation.**

# Allow R8 to inline final classes
-allowaccessmodification
