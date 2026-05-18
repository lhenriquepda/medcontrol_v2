package com.dosyapp.dosy.plugins.criticalalarm;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.net.Uri;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.Network;
import android.os.Build;
import android.os.PowerManager;
import android.media.RingtoneManager;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.dosyapp.dosy.MainActivity;
import com.dosyapp.dosy.R;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * AlarmReceiver — fired by AlarmManager at scheduled time.
 *
 * Posts a notification with setFullScreenIntent() (BAL workaround for Android 14+).
 * Receives a "doses" extra (JSON array). Renders count + concatenated meds.
 *
 * v0.2.3.13 — pre-fire HTTP check pra doses isShared=true. Se rede off/erro
 * AND cache local não conhece status final, sinaliza AlarmService com flag
 * `unverifiedShared` pra AlarmActivity exibir disclaimer em destaque. Doses
 * NÃO shared mantém fluxo original (sem regressão).
 */
public class AlarmReceiver extends BroadcastReceiver {

    // v0.2.3.1 — canal renomeado pra `dosy_alarm_fallback` (era `doses_critical_v2`
    // deletado por MainActivity.cleanupLegacyChannels = loop deleta-cria).
    // Canal usado apenas pelo fallback path quando startForegroundService falha (raro).
    // Mantém priority MAX + custom sound dosy_alarm.mp3 + bypassDND (alarme-like).
    private static final String CHANNEL_ID = "dosy_alarm_fallback";
    private static final int FS_NOTIF_OFFSET = 200_000_000;

    // #215 v0.2.3.0 — alinhado com src/services/notifications/unifiedScheduler.js BACKUP_OFFSET.
    // Alarme nativo disparou OK → cancela LocalNotification backup co-agendada
    // (anti-duplicate: user não vê alarme fullscreen + notif tray vibrando junto).
    // Se startForegroundService falhar (catch block abaixo), backup CONTINUA agendada
    // como fallback visual.
    // Fix overflow device-validation 2026-05-13: 700M → 2^30 (1073741824).
    private static final int BACKUP_OFFSET = 1073741824; // 2^30

    // v0.2.3.13 — timeouts curtos pra não bloquear receiver (limite 10s BroadcastReceiver).
    private static final int HTTP_CONNECT_TIMEOUT_MS = 1500;
    private static final int HTTP_READ_TIMEOUT_MS = 1500;

    @Override
    public void onReceive(Context context, Intent intent) {
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wl = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "Dosy:AlarmReceiver"
        );
        wl.acquire(15_000);

        final int alarmId = intent.getIntExtra("id", 0);
        String dosesJsonTmp = intent.getStringExtra("doses");
        if (dosesJsonTmp == null) dosesJsonTmp = "[]";
        final String dosesJson = dosesJsonTmp;

        // v0.2.3.1 Fix B — re-rota fire time. AlarmReceiver consulta prefs ATUAIS
        // antes de fire alarme fullscreen. Se prefs mudaram entre agendamento e fire
        // (ex: user toggle Critical OFF, DnD ON), re-rota pra TrayNotificationReceiver
        // sem disparar AlarmService (sem som, sem fullscreen).
        SharedPreferences spPrefs = context.getSharedPreferences("dosy_user_prefs", Context.MODE_PRIVATE);
        boolean criticalOn = spPrefs.getBoolean("critical_alarm_enabled", true);
        boolean dndOn = spPrefs.getBoolean("dnd_enabled", false);
        String dndStart = spPrefs.getString("dnd_start", "23:00");
        String dndEnd = spPrefs.getString("dnd_end", "07:00");
        long nowMs = System.currentTimeMillis();
        boolean inDnd = dndOn && AlarmScheduler.isInDndWindowPublic(nowMs, dndStart, dndEnd);
        if (!criticalOn || inDnd) {
            String channelId = inDnd ? AlarmScheduler.TRAY_DND_CHANNEL_ID : AlarmScheduler.TRAY_CHANNEL_ID;
            android.util.Log.d("AlarmReceiver", "Fix B re-rota fire time: criticalOn=" + criticalOn
                + " inDnd=" + inDnd + " channel=" + channelId);
            // Re-rota direto pra TrayNotificationReceiver sem AlarmService.
            Intent trayIntent = new Intent(context, TrayNotificationReceiver.class);
            trayIntent.putExtra("notifId", alarmId);
            trayIntent.putExtra("doses", dosesJson);
            trayIntent.putExtra("channelId", channelId);
            context.sendBroadcast(trayIntent);
            if (wl.isHeld()) wl.release();
            return;
        }

        // Audit: log fired event per dose (debug observability)
        try {
            JSONArray arrAudit = new JSONArray(dosesJson);
            for (int i = 0; i < arrAudit.length(); i++) {
                JSONObject d = arrAudit.getJSONObject(i);
                JSONObject meta = new JSONObject();
                meta.put("alarmId", alarmId);
                meta.put("groupSize", arrAudit.length());
                AlarmAuditLogger.logFired(
                    context, "java_alarm_scheduler",
                    d.optString("doseId", null),
                    d.optString("scheduledAt", null),
                    d.optString("patientName", null),
                    d.optString("medName", null),
                    meta
                );
            }
        } catch (Exception ignored) {}

        // #215 v0.2.3.0 + v0.2.3.1 Fix B-01: anti-duplicate cancel cobrindo race
        // mesmo timestamp. NotificationManagerCompat.cancel só cobre notif VISIVEL —
        // não cancela PendingIntent pendente no AlarmManager. Sem este fix, se
        // TrayNotificationReceiver dispara MS depois de AlarmReceiver (race no
        // mesmo trigger), tray ainda aparece duplicado com alarme.
        try {
            // 1) Cancel notif visível (caso TrayNotificationReceiver já tenha postado)
            NotificationManagerCompat.from(context).cancel(alarmId + BACKUP_OFFSET);
            // 2) Cancel PendingIntent pendente do TrayNotificationReceiver (race fix)
            Intent trayIntent = new Intent(context, TrayNotificationReceiver.class);
            PendingIntent trayPi = PendingIntent.getBroadcast(
                context, alarmId + BACKUP_OFFSET, trayIntent,
                PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
            );
            if (trayPi != null) {
                android.app.AlarmManager am = (android.app.AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
                if (am != null) am.cancel(trayPi);
                trayPi.cancel();
            }
        } catch (Exception ignored) {}

        // v0.2.3.13 — pre-check apenas pra doses isShared=true. Não shared mantém
        // fluxo original (zero regressão). Pre-check verifica server (HTTP 1.5s
        // timeout) + cache local pra detectar dose já marcada/cancelada por
        // outro cuidador, ANTES de despertar device. Se rede off/erro AND cache
        // não tem certeza → fire alarme COM disclaimer.
        final List<String> sharedDoseIds = collectSharedDoseIds(dosesJson);
        if (sharedDoseIds.isEmpty()) {
            // Path não-shared: dispatch direto sem disclaimer (comportamento atual).
            dispatchAlarm(context, alarmId, dosesJson, false);
            if (wl.isHeld()) wl.release();
            return;
        }

        // Path shared: goAsync + worker thread pra HTTP/cache pré-check.
        final PendingResult pendingResult = goAsync();
        final PowerManager.WakeLock asyncWl = wl;
        new Thread(() -> {
            boolean unverifiedShared = false;
            try {
                PreCheckOutcome outcome = runPreCheck(context, sharedDoseIds);
                android.util.Log.d("AlarmReceiver", "preCheck outcome=" + outcome.summary
                    + " alarmId=" + alarmId);
                if (outcome.allResolved) {
                    // Server/cache confirmaram TODAS doses já não-pending → cancela alarme.
                    AlarmScheduler.cancelDoseAlarmAndBackup(context, alarmId);
                    return;
                }
                unverifiedShared = outcome.unverified;
            } catch (Exception preErr) {
                // Pre-check exception → assume offline/erro → dispara COM disclaimer
                // (segura por padrão pra paciente compartilhado).
                android.util.Log.w("AlarmReceiver", "preCheck unexpected err: " + preErr.getMessage());
                unverifiedShared = true;
            } finally {
                try {
                    dispatchAlarm(context, alarmId, dosesJson, unverifiedShared);
                } catch (Exception dispatchErr) {
                    android.util.Log.e("AlarmReceiver", "dispatch err: " + dispatchErr.getMessage());
                } finally {
                    if (asyncWl != null && asyncWl.isHeld()) {
                        try { asyncWl.release(); } catch (Exception ignored) {}
                    }
                    pendingResult.finish();
                }
            }
        }, "Dosy-AlarmPreCheck").start();
    }

    /**
     * v0.2.3.13 — extrai doseIds com isShared=true. Vazio = patient não compartilhado
     * (skip pre-check).
     */
    private List<String> collectSharedDoseIds(String dosesJson) {
        List<String> ids = new ArrayList<>();
        try {
            JSONArray arr = new JSONArray(dosesJson);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject d = arr.getJSONObject(i);
                if (d.optBoolean("isShared", false)) {
                    String did = d.optString("doseId", "");
                    if (!did.isEmpty()) ids.add(did);
                }
            }
        } catch (Exception ignored) {}
        return ids;
    }

    /**
     * v0.2.3.13 — pre-check: HTTP server + cache fallback. Decide se alarme deve
     * cancelar, fire com disclaimer ou fire normal.
     */
    private static class PreCheckOutcome {
        boolean allResolved;     // TODAS doses já done/cancelled/skipped → cancelar alarme
        boolean unverified;      // ALGUMA dose sem confirmação → fire COM disclaimer
        String summary;          // log

        PreCheckOutcome(boolean allResolved, boolean unverified, String summary) {
            this.allResolved = allResolved;
            this.unverified = unverified;
            this.summary = summary;
        }
    }

    private PreCheckOutcome runPreCheck(Context ctx, List<String> doseIds) {
        // 1) Sem rede → vai direto pro cache
        boolean online = isOnline(ctx);
        Map<String, String> serverStatus = null;
        if (online) {
            serverStatus = fetchDoseStatusFromServer(ctx, doseIds);
        }

        if (serverStatus != null && !serverStatus.isEmpty()) {
            // HTTP OK: status autoritativo. Cache cada resposta pro próximo fire.
            SharedPreferences cache = ctx.getSharedPreferences("dosy_dose_status", Context.MODE_PRIVATE);
            SharedPreferences.Editor ed = cache.edit();
            long now = System.currentTimeMillis();
            boolean anyPending = false;
            int resolved = 0;
            for (String did : doseIds) {
                String status = serverStatus.get(did);
                if (status == null) {
                    // server não retornou row → dose deletada → trata como resolvido
                    ed.putString("status:" + did, "deleted");
                    ed.putLong("ts:" + did, now);
                    resolved++;
                    continue;
                }
                ed.putString("status:" + did, status);
                ed.putLong("ts:" + did, now);
                if ("pending".equalsIgnoreCase(status)) {
                    anyPending = true;
                } else {
                    resolved++;
                }
            }
            ed.apply();
            if (!anyPending) {
                return new PreCheckOutcome(true, false,
                    "server_all_resolved=" + resolved + "/" + doseIds.size());
            }
            // Server confirmou pending → fire SEM disclaimer (verificado online).
            return new PreCheckOutcome(false, false,
                "server_pending anyPending=true resolved=" + resolved + "/" + doseIds.size());
        }

        // HTTP falhou ou offline → consultar cache local.
        SharedPreferences cache = ctx.getSharedPreferences("dosy_dose_status", Context.MODE_PRIVATE);
        int resolvedFromCache = 0;
        int unknown = 0;
        for (String did : doseIds) {
            String cached = cache.getString("status:" + did, null);
            if (cached != null && !"pending".equalsIgnoreCase(cached)) {
                resolvedFromCache++;
            } else {
                unknown++;
            }
        }
        if (resolvedFromCache == doseIds.size()) {
            return new PreCheckOutcome(true, false,
                "cache_all_resolved=" + resolvedFromCache + " (offline)");
        }
        // Pelo menos uma dose sem confirmação → fire COM disclaimer.
        return new PreCheckOutcome(false, true,
            "unverified online=" + online + " resolved=" + resolvedFromCache + " unknown=" + unknown);
    }

    /**
     * v0.2.3.13 — Supabase REST GET medcontrol.doses?id=in.(uuid1,uuid2,...)&select=id,status.
     * Retorna mapa doseId→status. null se HTTP/auth falhar.
     */
    private Map<String, String> fetchDoseStatusFromServer(Context ctx, List<String> doseIds) {
        SharedPreferences sp = ctx.getSharedPreferences("dosy_sync_credentials", Context.MODE_PRIVATE);
        String supabaseUrl = sp.getString("supabase_url", null);
        String anonKey = sp.getString("anon_key", null);
        String accessToken = sp.getString("access_token", null);
        String schema = sp.getString("schema", "medcontrol");
        if (supabaseUrl == null || anonKey == null) return null;

        HttpURLConnection conn = null;
        BufferedReader rd = null;
        try {
            StringBuilder ids = new StringBuilder();
            for (int i = 0; i < doseIds.size(); i++) {
                if (i > 0) ids.append(',');
                ids.append(doseIds.get(i));
            }
            String urlStr = supabaseUrl + "/rest/v1/doses?id=in.("
                + URLEncoder.encode(ids.toString(), "UTF-8") + ")&select=id,status";
            URL url = new URL(urlStr);
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(HTTP_READ_TIMEOUT_MS);
            conn.setRequestProperty("apikey", anonKey);
            String bearer = (accessToken != null && !accessToken.isEmpty()) ? accessToken : anonKey;
            conn.setRequestProperty("Authorization", "Bearer " + bearer);
            conn.setRequestProperty("Accept-Profile", schema);
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestMethod("GET");
            int code = conn.getResponseCode();
            if (code != 200) {
                android.util.Log.w("AlarmReceiver", "preCheck HTTP " + code);
                return null;
            }
            rd = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"));
            StringBuilder body = new StringBuilder();
            String line;
            while ((line = rd.readLine()) != null) body.append(line);
            JSONArray arr = new JSONArray(body.toString());
            Map<String, String> out = new HashMap<>();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                String id = o.optString("id", "");
                String status = o.optString("status", "");
                if (!id.isEmpty()) out.put(id, status);
            }
            return out;
        } catch (Exception e) {
            android.util.Log.w("AlarmReceiver", "preCheck HTTP err: " + e.getMessage());
            return null;
        } finally {
            try { if (rd != null) rd.close(); } catch (Exception ignored) {}
            try { if (conn != null) conn.disconnect(); } catch (Exception ignored) {}
        }
    }

    private boolean isOnline(Context ctx) {
        try {
            ConnectivityManager cm = (ConnectivityManager) ctx.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return false;
            Network active = cm.getActiveNetwork();
            if (active == null) return false;
            NetworkCapabilities nc = cm.getNetworkCapabilities(active);
            if (nc == null) return false;
            return nc.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                && nc.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Despacha alarme: primary AlarmService FG, fallback full-screen notification.
     * v0.2.3.13 — passa flag `unverifiedShared` pro AlarmService que propaga ao Activity.
     */
    private void dispatchAlarm(Context context, int alarmId, String dosesJson, boolean unverifiedShared) {
        // Primary path (Android 8+): start foreground service → service launches AlarmActivity.
        // FGS-style exemption bypasses BAL (Background Activity Launch) on Android 14+.
        try {
            Intent svc = new Intent(context, AlarmService.class);
            svc.putExtra("id", alarmId);
            svc.putExtra("doses", dosesJson);
            svc.putExtra("unverifiedShared", unverifiedShared);
            ContextCompat.startForegroundService(context, svc);
            return;
        } catch (Exception e) {
            e.printStackTrace();
            // Fall through to notification-only fallback below
        }

        // Fallback: full-screen intent notification (only fires fullscreen if user
        // granted USE_FULL_SCREEN_INTENT; otherwise reduces to heads-up).
        // Parse doses for notification body + collect IDs for tap intent
        int count = 0;
        StringBuilder bodyBuilder = new StringBuilder();
        StringBuilder idsCsv = new StringBuilder();
        String firstMed = "Dose";
        try {
            JSONArray arr = new JSONArray(dosesJson);
            count = arr.length();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject d = arr.getJSONObject(i);
                String med = d.optString("medName", "Dose");
                String unit = d.optString("unit", "");
                String did = d.optString("doseId", "");
                if (i == 0) firstMed = med;
                if (bodyBuilder.length() > 0) bodyBuilder.append(" · ");
                bodyBuilder.append(med);
                if (!unit.isEmpty()) bodyBuilder.append(" (").append(unit).append(")");
                if (!did.isEmpty()) {
                    if (idsCsv.length() > 0) idsCsv.append(",");
                    idsCsv.append(did);
                }
            }
        } catch (Exception ignored) {}

        ensureChannel(context);

        // Full-screen intent → AlarmActivity (system launches when device locked)
        Intent activityIntent = new Intent(context, AlarmActivity.class);
        activityIntent.setFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK
            | Intent.FLAG_ACTIVITY_CLEAR_TOP
            | Intent.FLAG_ACTIVITY_NO_USER_ACTION
        );
        activityIntent.putExtra("id", alarmId);
        activityIntent.putExtra("doses", dosesJson);
        activityIntent.putExtra("unverifiedShared", unverifiedShared);

        PendingIntent fullScreenPi = PendingIntent.getActivity(
            context,
            alarmId,
            activityIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Tap (heads-up / unlocked) → MainActivity with openDoseIds → opens DoseModal queue
        Intent tapIntent = new Intent(context, MainActivity.class);
        tapIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (idsCsv.length() > 0) tapIntent.putExtra("openDoseIds", idsCsv.toString());

        PendingIntent tapPi = PendingIntent.getActivity(
            context,
            alarmId + FS_NOTIF_OFFSET,
            tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String title = count <= 1
            ? "💊 Hora da medicação — " + firstMed
            : "💊 " + count + " doses agora";
        // v0.2.3.13 — fallback notif também sinaliza disclaimer pra cuidador caso
        // FGS falhe (raro).
        if (unverifiedShared) {
            title = "⚠️ " + title + " (verificar)";
        }

        String displayBody = bodyBuilder.toString();
        if (unverifiedShared) {
            displayBody = "Sem internet pra verificar com outros cuidadores. Confirme se a dose já foi dada antes de medicar.\n\n" + displayBody;
        }

        NotificationCompat.Builder b = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_dosy)
            .setColor(0xFFFF6B5B)
            .setContentTitle(title)
            .setContentText(bodyBuilder.toString())
            .setStyle(new NotificationCompat.BigTextStyle().bigText(displayBody))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(false)
            .setAutoCancel(true)
            .setContentIntent(tapPi)
            .setFullScreenIntent(fullScreenPi, true);

        NotificationManagerCompat nm = NotificationManagerCompat.from(context);
        try {
            nm.notify(alarmId + FS_NOTIF_OFFSET, b.build());
        } catch (SecurityException ignored) {}
    }

    private void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return;

        NotificationChannel ch = new NotificationChannel(
            CHANNEL_ID,
            "Alarmes de Dose",
            NotificationManager.IMPORTANCE_HIGH
        );
        ch.setDescription("Lembretes críticos de medicação (alarme estilo despertador)");
        ch.enableLights(true);
        ch.enableVibration(true);
        ch.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        ch.setBypassDnd(true);

        // Item #203 (release v0.2.1.5+) — som customizado dosy_alarm.mp3 em res/raw/.
        // Se ausente fallback ringtone padrão. Channel + AlarmService usam o mesmo
        // arquivo pra som consistente entre notification tray e fullscreen alarm.
        Uri sound = null;
        int rawId = context.getResources().getIdentifier("dosy_alarm", "raw", context.getPackageName());
        if (rawId != 0) {
            sound = Uri.parse("android.resource://" + context.getPackageName() + "/" + rawId);
        }
        if (sound == null) sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (sound == null) sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        AudioAttributes attrs = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        ch.setSound(sound, attrs);

        nm.createNotificationChannel(ch);
    }
}
