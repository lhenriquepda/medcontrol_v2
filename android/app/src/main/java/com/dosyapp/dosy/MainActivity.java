package com.dosyapp.dosy;

import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;

import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.dosyapp.dosy.plugins.criticalalarm.CriticalAlarmPlugin;
import com.dosyapp.dosy.plugins.criticalalarm.AlarmService;
import com.dosyapp.dosy.plugins.criticalalarm.DoseSyncWorker;
import com.getcapacitor.BridgeActivity;

import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CriticalAlarmPlugin.class);
        super.onCreate(savedInstanceState);
        handleAlarmAction(getIntent());
        // v0.2.3.3 #232 fix — WorkManager.enqueueUniquePeriodicWork pode bloquear main thread
        // durante init Room DB (Sentry DOSY-M ANR `java.lang.Object.wait` em onCreate). Mover
        // enqueue + cleanupChannels pra background thread. Idempotente, sem dependência síncrona.
        Executors.newSingleThreadExecutor().execute(() -> {
            enqueueDoseSyncWorker();
            cleanupLegacyChannels();
        });
    }

    /**
     * Cleanup canais legados deletados (idempotente — no-op se não existir).
     *
     * Canais deletados:
     *   - doses_v2          (LocalNotifications pré-#215)
     *   - doses_critical_v2 (AlarmReceiver fallback pré-#215, renomeado dosy_alarm_fallback)
     *   - dosy_tray_dnd     (Capacitor criou com som default por bug — substituído por dosy_tray_dnd_v2)
     *
     * Canais mantidos:
     *   - doses_critical (AlarmService FG sound null — MediaPlayer drives loop)
     *   - dosy_tray (Capacitor channels.js cria pra trays normais + daily summary)
     *   - dosy_tray_dnd_v2 (Java AlarmScheduler.ensureTrayChannel cria sob-demand com sound:null)
     *   - dosy_alarm_fallback (AlarmReceiver fallback path)
     */
    private void cleanupLegacyChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            nm.deleteNotificationChannel("doses_v2");
            nm.deleteNotificationChannel("doses_critical_v2");
            nm.deleteNotificationChannel("dosy_tray_dnd"); // v0.2.3.1 — Capacitor criou com som default
        } catch (Exception e) {
            android.util.Log.w("MainActivity", "cleanupLegacyChannels failed: " + e.getMessage());
        }
    }

    /**
     * Item #081 (release v0.1.7.1) — agenda DoseSyncWorker periódico (6h).
     * Worker fetcha doses pendentes próximas 72h via Supabase REST e agenda
     * alarmes nativos via setAlarmClock(). Idempotente (KEEP policy reusa
     * registro existente, seguro chamar em todo onCreate).
     */
    private void enqueueDoseSyncWorker() {
        try {
            PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(
                DoseSyncWorker.class, 6, TimeUnit.HOURS
            ).build();
            WorkManager.getInstance(this).enqueueUniquePeriodicWork(
                "dosy-dose-sync",
                ExistingPeriodicWorkPolicy.KEEP,
                req
            );
        } catch (Exception e) {
            android.util.Log.w("MainActivity", "enqueueDoseSyncWorker failed: " + e.getMessage());
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleAlarmAction(intent);
    }

    /**
     * Processa intents do AlarmActivity / notif persistente.
     *
     *   openDoseId  → tap na notificação persistente — abre DoseModal
     *   alarmAction → tap em botão dentro do AlarmActivity (legado, não usado mais)
     */
    private void handleAlarmAction(Intent intent) {
        if (intent == null) return;

        String openDoseIds = intent.getStringExtra("openDoseIds");
        if (openDoseIds != null) {
            intent.removeExtra("openDoseIds");
            // User tapped notif → silence active alarm
            AlarmService.stopActiveAlarm(this);
            postJsEvent("dosy:openDoses", "doseIds", openDoseIds);
            return;
        }

        String openDoseId = intent.getStringExtra("openDoseId");
        if (openDoseId != null) {
            intent.removeExtra("openDoseId");
            AlarmService.stopActiveAlarm(this);
            postJsEvent("dosy:openDose", "doseId", openDoseId);
            return;
        }
    }

    private void postJsEvent(String eventName, String key, String value) {
        // Set global var IMMEDIATELY (covers cold start: JS reads on mount)
        // Plus dispatch event with retries (covers warm start: listener already bound)
        String safeVal = value.replace("'", "\\'");
        String varName = key.equals("doseIds") ? "__dosyPendingDoseIds" : "__dosyPendingDoseId";
        String setVar = String.format("window.%s = '%s';", varName, safeVal);
        String dispatch = String.format(
            "window.dispatchEvent(new CustomEvent('%s', { detail: { %s: '%s' } }));",
            eventName, key, safeVal
        );
        String js = setVar + dispatch;
        postJsRaw(js, 300);
        postJsRaw(js, 1500);
        postJsRaw(js, 3500);
    }

    private void postJsRaw(String js, long delayMs) {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        getBridge().getWebView().postDelayed(
            () -> getBridge().getWebView().evaluateJavascript(js, null),
            delayMs
        );
    }
}
