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
     * Item #081 (release v0.1.7.1) — agenda DoseSyncWorker periódico.
     * Worker fetcha doses pendentes próximas 48h via Supabase REST e agenda
     * alarmes nativos via setAlarmClock(). Idempotente — AlarmScheduler.scheduleDose
     * agora verifica SharedPrefs antes de chamar AlarmManager (#282 v0.2.3.7),
     * skip se mesmo id já tem triggerAt + dosesHash iguais.
     *
     * v0.2.3.7 #282 — período 6h → 24h. Conjunto com server-side cron
     * daily-alarm-sync (5am UTC). Worker é backup local pra cobrir Samsung
     * Adaptive Battery / Doze profundo que matam aplicativo por 3+ dias
     * inatividade. 1×/dia mantém aplicativo "ativo" aos olhos do sistema +
     * realimenta cache de alarmes locais (recovery se Samsung os esqueceu).
     * Sem storm: AlarmScheduler idempotent skipa reagendamento se igual.
     */
    private void enqueueDoseSyncWorker() {
        try {
            PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(
                DoseSyncWorker.class, 24, TimeUnit.HOURS
            ).build();
            // v0.2.3.7 #282 — REPLACE policy força adoção do novo intervalo 24h.
            // KEEP manteria registro 6h antigo de instalações existentes.
            // Idempotência runtime preservada via AlarmScheduler skip-if-same.
            WorkManager.getInstance(this).enqueueUniquePeriodicWork(
                "dosy-dose-sync",
                ExistingPeriodicWorkPolicy.REPLACE,
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
        if (intent == null) {
            android.util.Log.i("MainActivity", "[handleAlarmAction] intent=null");
            return;
        }

        // v0.2.3.7 #280 debug — dump ALL extras to identify FCM tap intent shape
        android.os.Bundle extras = intent.getExtras();
        if (extras != null) {
            StringBuilder sb = new StringBuilder("[handleAlarmAction] extras: ");
            for (String key : extras.keySet()) {
                Object v = extras.get(key);
                String vs = v == null ? "null" : v.toString();
                if (vs.length() > 60) vs = vs.substring(0, 60) + "…";
                sb.append(key).append("=").append(vs).append("; ");
            }
            android.util.Log.i("MainActivity", sb.toString());
        } else {
            android.util.Log.i("MainActivity", "[handleAlarmAction] no extras");
        }

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

        // v0.2.3.7 Bug B fix — FCM share notification tap branch.
        // Edge `patient-share-handler` sends data.kind=patient_share_added +
        // data.patientId. App navigates to /pacientes/:id on tap.
        String kind = intent.getStringExtra("kind");
        if ("patient_share_added".equals(kind)) {
            String patientId = intent.getStringExtra("patientId");
            if (patientId != null) {
                intent.removeExtra("kind");
                intent.removeExtra("patientId");
                postJsEvent("dosy:openPatient", "patientId", patientId);
                return;
            }
        }

        // FCM fire-time tap fallback — data.doseId present even though
        // openDoseId may be null on some Android FCM intent serialization paths.
        String doseId = intent.getStringExtra("doseId");
        String fcmKind = kind != null ? kind : intent.getStringExtra("kind");
        if (doseId != null && ("dose_fire_time".equals(fcmKind) || fcmKind == null)) {
            intent.removeExtra("doseId");
            AlarmService.stopActiveAlarm(this);
            postJsEvent("dosy:openDose", "doseId", doseId);
            return;
        }
    }

    private void postJsEvent(String eventName, String key, String value) {
        // Set global var IMMEDIATELY (covers cold start: JS reads on mount)
        // Plus dispatch event with retries (covers warm start: listener already bound)
        String safeVal = value.replace("'", "\\'");
        // v0.2.3.7 Bug B fix — support patientId var alongside doseId/doseIds.
        String varName;
        if ("doseIds".equals(key)) varName = "__dosyPendingDoseIds";
        else if ("patientId".equals(key)) varName = "__dosyPendingPatientId";
        else varName = "__dosyPendingDoseId";
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
