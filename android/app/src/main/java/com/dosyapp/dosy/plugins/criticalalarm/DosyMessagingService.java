package com.dosyapp.dosy.plugins.criticalalarm;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.NonNull;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/**
 * Item #083.5 (release v0.1.7.2) — FCM-driven alarm scheduling.
 *
 * Estende MessagingService do Capacitor pra interceptar mensagens FCM
 * com action `schedule_alarms` ANTES do Capacitor processá-las como
 * notificação normal.
 *
 * Comportamento:
 *   - data.action == "schedule_alarms" → processa silenciosamente:
 *     parseia lista de doses + chama AlarmScheduler.scheduleDose pra cada,
 *     reporta server-side via dose_alarms_scheduled, NÃO mostra notif
 *   - qualquer outra mensagem → delega pra super (Capacitor processa
 *     normal: notif tray ou push handler JS)
 *
 * Defense-in-depth caminho 1+2: Trigger DB e cron 6h podem ambos enviar
 * FCM data — alarme agendado é idempotente (mesmo id = replace).
 */
public class DosyMessagingService extends MessagingService {
    private static final String TAG = "DosyMessagingService";
    private static final String SYNC_PREFS = "dosy_sync_credentials";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        String action = data != null ? data.get("action") : null;

        if ("schedule_alarms".equals(action)) {
            try {
                handleScheduleAlarms(data.get("doses"));
                // NÃO chama super — não mostra notif tray pra esta mensagem
                return;
            } catch (Exception e) {
                Log.e(TAG, "schedule_alarms handler error: " + e.getMessage(), e);
                // Fallback: deixa Capacitor processar como notif normal
            }
        }

        // Mensagem regular: passa pra Capacitor (notif tray + push handler JS)
        super.onMessageReceived(remoteMessage);
    }

    /**
     * Parseia payload data.doses (JSON array) e agenda alarme nativo
     * pra cada dose. Reporta server-side.
     *
     * Payload esperado:
     *   data.doses = JSON.stringify([
     *     {doseId, scheduledAt, medName, unit, patientName?},
     *     ...
     *   ])
     */
    private void handleScheduleAlarms(String dosesJson) throws JSONException {
        if (dosesJson == null) return;

        Context ctx = getApplicationContext();
        JSONArray doses = new JSONArray(dosesJson);
        Log.d(TAG, "schedule_alarms: " + doses.length() + " doses");

        // Group by minute (mesma lógica do DoseSyncWorker)
        Map<Long, JSONArray> groups = new TreeMap<>();
        Map<Long, Set<String>> doseIdsByMinute = new HashMap<>();

        for (int i = 0; i < doses.length(); i++) {
            JSONObject d = doses.getJSONObject(i);
            String scheduledAt = d.getString("scheduledAt");
            long ms = Instant.parse(scheduledAt).toEpochMilli();
            long minute = (ms / 60000L) * 60000L;

            if (!groups.containsKey(minute)) groups.put(minute, new JSONArray());
            if (!doseIdsByMinute.containsKey(minute)) doseIdsByMinute.put(minute, new HashSet<>());

            JSONObject entry = new JSONObject();
            entry.put("doseId", d.getString("doseId"));
            entry.put("medName", d.optString("medName", "Dose"));
            entry.put("unit", d.optString("unit", ""));
            entry.put("patientName", d.optString("patientName", ""));
            groups.get(minute).put(entry);
            doseIdsByMinute.get(minute).add(d.getString("doseId"));
        }

        int scheduled = 0;
        for (Map.Entry<Long, JSONArray> e : groups.entrySet()) {
            Set<String> ids = doseIdsByMinute.get(e.getKey());
            String[] sorted = ids.toArray(new String[0]);
            java.util.Arrays.sort(sorted);
            String groupKey = String.join("|", sorted);
            int alarmId = AlarmScheduler.idFromString(groupKey);

            if (AlarmScheduler.scheduleDose(ctx, alarmId, e.getKey(), e.getValue())) {
                scheduled++;
                // Reporta server-side pra cada dose individualmente — permite
                // notify-doses cron skip push se alarme já agendado
                for (int i = 0; i < e.getValue().length(); i++) {
                    try {
                        String doseId = e.getValue().getJSONObject(i).getString("doseId");
                        reportAlarmScheduled(ctx, doseId);
                    } catch (Exception ex) {
                        Log.w(TAG, "reportAlarmScheduled fail: " + ex.getMessage());
                    }
                }
            }
        }
        Log.d(TAG, "scheduled groups=" + scheduled);
    }

    /**
     * Item #083.6 — POST pra Supabase REST registrando que esta dose+device
     * tem alarme agendado localmente. Permite notify-doses cron skip push tray.
     *
     * Auth: usa anon key + access_token via refresh_token armazenado.
     * Idempotente (PK doseId+deviceId, INSERT ON CONFLICT DO NOTHING).
     */
    static void reportAlarmScheduled(Context ctx, String doseId) {
        SharedPreferences sp = ctx.getSharedPreferences(SYNC_PREFS, Context.MODE_PRIVATE);
        String url = sp.getString("supabase_url", null);
        String anon = sp.getString("anon_key", null);
        String userId = sp.getString("user_id", null);
        String refreshToken = sp.getString("refresh_token", null);
        String deviceId = sp.getString("device_id", null);
        String schema = sp.getString("schema", "medcontrol");

        if (url == null || anon == null || userId == null || refreshToken == null || deviceId == null) {
            Log.d(TAG, "reportAlarmScheduled skip: missing credentials");
            return;
        }

        try {
            // Refresh access_token (mesmo helper do DoseSyncWorker)
            String accessToken = refreshAccessToken(url, anon, refreshToken, sp);
            if (accessToken == null) return;

            JSONObject body = new JSONObject();
            body.put("doseId", doseId);
            body.put("userId", userId);
            body.put("deviceId", deviceId);
            body.put("via", "fcm-data");

            HttpURLConnection conn = (HttpURLConnection) new URL(url + "/rest/v1/dose_alarms_scheduled").openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("apikey", anon);
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Content-Profile", schema);
            conn.setRequestProperty("Prefer", "resolution=ignore-duplicates"); // PK conflict = skip
            conn.setDoOutput(true);
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }

            int status = conn.getResponseCode();
            if (status != 201 && status != 200 && status != 409) {
                Log.w(TAG, "reportAlarmScheduled status=" + status);
            }
        } catch (Exception e) {
            Log.w(TAG, "reportAlarmScheduled error: " + e.getMessage());
        }
    }

    private static String refreshAccessToken(String url, String anon, String refreshToken, SharedPreferences sp) throws IOException, JSONException {
        URL endpoint = new URL(url + "/auth/v1/token?grant_type=refresh_token");
        HttpURLConnection conn = (HttpURLConnection) endpoint.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("apikey", anon);
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);
        conn.setConnectTimeout(10000);
        conn.setReadTimeout(10000);

        String body = new JSONObject().put("refresh_token", refreshToken).toString();
        try (OutputStream os = conn.getOutputStream()) {
            os.write(body.getBytes(StandardCharsets.UTF_8));
        }

        if (conn.getResponseCode() != 200) return null;

        BufferedReader r = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = r.readLine()) != null) sb.append(line);
        r.close();

        JSONObject json = new JSONObject(sb.toString());
        String access = json.getString("access_token");
        String newRefresh = json.optString("refresh_token", refreshToken);
        sp.edit().putString("refresh_token", newRefresh).apply();
        return access;
    }
}
