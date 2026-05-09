package com.dosyapp.dosy.plugins.criticalalarm;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

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
import java.time.Duration;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/**
 * DoseSyncWorker — Item #081 (release v0.1.7.1) defense-in-depth caminho 3 de 3.
 *
 * Roda periodicamente (a cada 6h via WorkManager) mesmo com app fechado.
 * Faz fetch das doses pendentes próximas 72h via Supabase REST API e
 * agenda alarmes nativos via setAlarmClock() (bypassa Doze).
 *
 * Não depende de:
 *   - app foreground / recente-active
 *   - websocket realtime vivo
 *   - push FCM funcionando
 *
 * Garante que mesmo user idoso que NÃO abre app mensalmente, alarmes de
 * doses agendadas nos próximos 72h disparam pontualmente.
 *
 * Auth: lê credentials de SharedPreferences (gravadas pelo plugin
 * setSyncCredentials() chamado pelo JS após login). Refresh access_token
 * via /auth/v1/token?grant_type=refresh_token quando expira (default 1h).
 */
public class DoseSyncWorker extends Worker {
    private static final String TAG = "DoseSyncWorker";
    private static final String SYNC_PREFS = "dosy_sync_credentials";
    // Item #207 (release v0.2.1.7) — 72h → 168h (7d) alinhado com SCHEDULE_WINDOW_MS JS.
    // WorkManager 6h periodic cobre janela inteira mesmo se app fechado vários dias.
    private static final long HORIZON_HOURS = 168L;

    public DoseSyncWorker(@NonNull Context ctx, @NonNull WorkerParameters params) {
        super(ctx, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        SharedPreferences sp = ctx.getSharedPreferences(SYNC_PREFS, Context.MODE_PRIVATE);
        String url = sp.getString("supabase_url", null);
        String anon = sp.getString("anon_key", null);
        String userId = sp.getString("user_id", null);
        String refreshToken = sp.getString("refresh_token", null);
        String schema = sp.getString("schema", "medcontrol");

        if (url == null || anon == null || userId == null || refreshToken == null) {
            Log.d(TAG, "no credentials yet — skip");
            return Result.success(); // não retry — user ainda não logou
        }

        // Item #085 (release v0.1.7.3) — respeita toggle Alarme Crítico do user.
        // Se OFF, skip scheduling (notify-doses cron mandará push tray).
        // Default true se SP ausente (alarme ON pre-existing behavior).
        boolean criticalAlarmEnabled = sp.getBoolean("critical_alarm_enabled", true);
        if (!criticalAlarmEnabled) {
            Log.d(TAG, "critical alarm OFF — skip schedule (push tray covers)");
            return Result.success();
        }

        try {
            String accessToken = refreshAccessToken(url, anon, refreshToken, sp);
            if (accessToken == null) {
                Log.w(TAG, "refresh token failed — credentials may be stale");
                return Result.success();
            }

            JSONArray doses = fetchUpcomingDoses(url, anon, schema, accessToken);
            if (doses == null) {
                Log.w(TAG, "fetch doses failed");
                return Result.retry();
            }

            int scheduled = scheduleDoses(ctx, doses);
            Log.d(TAG, "sync ok: fetched=" + doses.length() + " scheduled=" + scheduled);
            return Result.success();
        } catch (Exception e) {
            Log.e(TAG, "sync error: " + e.getMessage(), e);
            return Result.retry();
        }
    }

    private String refreshAccessToken(String url, String anon, String refreshToken, SharedPreferences sp) throws IOException, JSONException {
        URL endpoint = new URL(url + "/auth/v1/token?grant_type=refresh_token");
        HttpURLConnection conn = (HttpURLConnection) endpoint.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("apikey", anon);
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(15000);

        String body = new JSONObject().put("refresh_token", refreshToken).toString();
        try (OutputStream os = conn.getOutputStream()) {
            os.write(body.getBytes(StandardCharsets.UTF_8));
        }

        if (conn.getResponseCode() != 200) {
            Log.w(TAG, "token refresh status=" + conn.getResponseCode());
            return null;
        }

        String resp = readBody(conn);
        JSONObject json = new JSONObject(resp);
        String access = json.getString("access_token");
        String newRefresh = json.optString("refresh_token", refreshToken);

        // Persiste novo refresh_token (Supabase rotaciona a cada uso)
        sp.edit().putString("refresh_token", newRefresh).apply();
        return access;
    }

    private JSONArray fetchUpcomingDoses(String url, String anon, String schema, String accessToken) throws IOException, JSONException {
        Instant now = Instant.now();
        Instant horizon = now.plus(Duration.ofHours(HORIZON_HOURS));

        String qs = "/rest/v1/doses"
            + "?select=id,medName,unit,scheduledAt,patientId,treatmentId"
            + "&status=eq.pending"
            + "&scheduledAt=gte." + now.toString()
            + "&scheduledAt=lte." + horizon.toString()
            + "&order=scheduledAt.asc"
            + "&limit=500";

        URL endpoint = new URL(url + qs);
        HttpURLConnection conn = (HttpURLConnection) endpoint.openConnection();
        conn.setRequestMethod("GET");
        conn.setRequestProperty("apikey", anon);
        conn.setRequestProperty("Authorization", "Bearer " + accessToken);
        conn.setRequestProperty("Accept-Profile", schema);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(15000);

        int status = conn.getResponseCode();
        if (status != 200) {
            Log.w(TAG, "fetch doses status=" + status);
            return null;
        }

        return new JSONArray(readBody(conn));
    }

    /**
     * Agrupa doses pelo minuto exato (mesmo behavior do JS) e agenda 1
     * alarme por grupo via AlarmScheduler. Cada grupo recebe id determinístico
     * baseado em concat dos doseIds — coincide com JS pra evitar duplicatas.
     */
    private int scheduleDoses(Context ctx, JSONArray doses) throws JSONException {
        // Group by minute (ms truncado)
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
            entry.put("doseId", d.getString("id"));
            entry.put("medName", d.optString("medName", "Dose"));
            entry.put("unit", d.optString("unit", ""));
            entry.put("patientName", "");
            groups.get(minute).put(entry);
            doseIdsByMinute.get(minute).add(d.getString("id"));
        }

        int scheduled = 0;
        for (Map.Entry<Long, JSONArray> e : groups.entrySet()) {
            // group key: doseIds concat sorted (mesmo do JS)
            Set<String> ids = doseIdsByMinute.get(e.getKey());
            String[] sorted = ids.toArray(new String[0]);
            java.util.Arrays.sort(sorted);
            String groupKey = String.join("|", sorted);
            int id = AlarmScheduler.idFromString(groupKey);

            if (AlarmScheduler.scheduleDose(ctx, id, e.getKey(), e.getValue())) {
                scheduled++;
            }
        }
        return scheduled;
    }

    private String readBody(HttpURLConnection conn) throws IOException {
        try (BufferedReader r = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = r.readLine()) != null) sb.append(line);
            return sb.toString();
        }
    }
}
