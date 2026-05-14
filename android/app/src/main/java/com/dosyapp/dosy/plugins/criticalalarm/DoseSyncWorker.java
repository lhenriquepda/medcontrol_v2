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
 * Faz fetch das doses pendentes próximas 7d via Supabase REST API e
 * agenda alarmes nativos via setAlarmClock() (bypassa Doze).
 *
 * Não depende de:
 *   - app foreground / recente-active
 *   - websocket realtime vivo
 *   - push FCM funcionando
 *
 * Garante que mesmo user idoso que NÃO abre app mensalmente, alarmes de
 * doses agendadas nos próximos 7d disparam pontualmente.
 *
 * Item #205 (release v0.2.1.8) — REMOVE refresh_token endpoint call.
 * Antes: Worker + DosyMessagingService + JS supabase-js cada um chamava
 * /auth/v1/token?grant_type=refresh_token em paralelo no xx:00 (JWT exp 1h).
 * Supabase detectava token reuse → revogava chain → user re-login forçado.
 *
 * Agora: JS supabase-js é ÚNICA fonte refresh. Worker lê `access_token` cached
 * em SharedPref (gravado pelo plugin updateAccessToken em TOKEN_REFRESHED event).
 * Se access_token expirou (verificado via access_token_exp_ms local), Worker
 * pula a rodada — próxima execução periódica pegará token fresco depois do JS
 * ter refeito refresh em foreground.
 */
public class DoseSyncWorker extends Worker {
    private static final String TAG = "DoseSyncWorker";
    private static final String SYNC_PREFS = "dosy_sync_credentials";
    // Item #209 (release v0.2.1.9) — 168h → 48h alinhado com daily-alarm-sync cron.
    // Cron diário 5am cobre janela 48h (margem 24h até próximo cron). Worker
    // periodic 6h funciona como defense-in-depth caso FCM falhe entrega.
    private static final long HORIZON_HOURS = 48L;
    // Item #205 — margem de segurança expiry.
    // v0.2.3.3 #233 — bump 60s → 300s pra antecipar skip em clock skew device físico
    // (Supabase API Gateway observability 14/05 revelou 16 401s em 60min — JWT exp check
    // local vs server clock pode ter drift até 2-3min em devices Android). Worker pula
    // rodada mais cedo, JS app foreground refresca token, próxima rodada periódica 6h
    // pega token fresco. Trade-off: ligeiro atraso ao acordar pós-suspensão longa, mas
    // elimina 401 noise na API + economiza ~500 bytes egress por rodada falha.
    private static final long EXP_SAFETY_MARGIN_MS = 300_000L;

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
        String schema = sp.getString("schema", "medcontrol");
        String accessToken = sp.getString("access_token", null);
        long accessTokenExp = sp.getLong("access_token_exp_ms", 0L);

        if (url == null || anon == null || userId == null) {
            Log.d(TAG, "no credentials yet — skip");
            return Result.success(); // não retry — user ainda não logou
        }

        // v0.2.3.1 Bloco 6 (A-05) — le do namespace unificado dosy_user_prefs.
        // Antes lia de dosy_sync_credentials.critical_alarm_enabled (legacy) +
        // useUserPrefs JS escrevia em DOIS namespaces. Agora apenas dosy_user_prefs
        // gravado pelo syncUserPrefs.
        // Fallback legacy mantido pra usuarios que ainda nao re-logaram pos refactor.
        SharedPreferences spPrefs = ctx.getSharedPreferences("dosy_user_prefs", Context.MODE_PRIVATE);
        boolean criticalAlarmEnabled;
        if (spPrefs.contains("critical_alarm_enabled")) {
            criticalAlarmEnabled = spPrefs.getBoolean("critical_alarm_enabled", true);
        } else {
            criticalAlarmEnabled = sp.getBoolean("critical_alarm_enabled", true);
        }
        // v0.2.3.1 Fix B-like — NOTA: NAO returna early pra critical OFF.
        // Worker delega scheduling decision pro helper AlarmScheduler.scheduleDoseAlarm
        // que decide branch (alarm/tray) por dose via prefsOverride. Mas pra economizar
        // bateria + egress, se critical OFF + DnD OFF, ainda processa pra agendar trays.
        // Se critical OFF E user nao quer trays nenhum, push pref master deveria estar OFF.
        if (!criticalAlarmEnabled) {
            Log.d(TAG, "critical alarm OFF — Worker continua pra agendar trays (Plano A unificado)");
        }

        // Item #205 — verifica access_token local + exp. NÃO chama refresh endpoint.
        if (accessToken == null) {
            Log.d(TAG, "no access_token cached yet — JS app didn't sync token. Skip rodada.");
            return Result.success();
        }
        long now = System.currentTimeMillis();
        if (accessTokenExp > 0 && (now + EXP_SAFETY_MARGIN_MS) >= accessTokenExp) {
            // Token expirado/quase-expirado. JS app vai refresh quando abrir / em
            // foreground. Worker NÃO força refresh paralelo pra evitar storm.
            // WorkManager periodic retry pega token fresco depois.
            Log.d(TAG, "access_token expired/near-expiry (exp=" + accessTokenExp +
                       " now=" + now + ") — skip rodada");
            return Result.success();
        }

        try {
            JSONArray doses = fetchUpcomingDoses(url, anon, schema, accessToken);
            if (doses == null) {
                Log.w(TAG, "fetch doses failed (likely token rejected) — skip rodada");
                // Result.success — NÃO retry pra evitar storm. JS refresca em foreground.
                return Result.success();
            }

            // #215 v0.2.3.0 fix race-condition device-validation 2026-05-13:
            // fetch user_prefs DB pra prefsOverride autoritativo (não confiar
            // em SharedPreferences que pode estar stale).
            JSONObject prefsOverride = fetchUserPrefs(url, anon, schema, accessToken, userId);
            int scheduled = scheduleDoses(ctx, doses, prefsOverride);
            Log.d(TAG, "sync ok: fetched=" + doses.length() + " scheduled=" + scheduled);
            return Result.success();
        } catch (Exception e) {
            Log.e(TAG, "sync error: " + e.getMessage(), e);
            return Result.retry();
        }
    }

    private JSONArray fetchUpcomingDoses(String url, String anon, String schema, String accessToken) throws IOException, JSONException {
        Instant now = Instant.now();
        Instant horizon = now.plus(Duration.ofHours(HORIZON_HOURS));

        // Item #209 v0.2.1.9 Bug 1 fix — embed patients(name) na query PostgREST.
        // Antes Worker hardcoded patientName="" causando alarme "Sem Paciente"
        // quando Worker era fonte do scheduling (Samsung One UI 7 caso comum).
        String qs = "/rest/v1/doses"
            + "?select=id,medName,unit,scheduledAt,patientId,treatmentId,patients(name)"
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
    /**
     * #215 v0.2.3.0 fix — fetch user_prefs.prefs jsonb pra prefsOverride.
     * Retorna JSON {criticalAlarm, dndEnabled, dndStart, dndEnd} OR null se falhar.
     */
    private JSONObject fetchUserPrefs(String url, String anon, String schema,
                                       String accessToken, String userId) {
        try {
            String qs = "/rest/v1/user_prefs?select=prefs&user_id=eq." + userId + "&limit=1";
            URL endpoint = new URL(url + qs);
            HttpURLConnection conn = (HttpURLConnection) endpoint.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("apikey", anon);
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);
            conn.setRequestProperty("Accept-Profile", schema);
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            if (conn.getResponseCode() != 200) return null;
            String body = readBody(conn);
            JSONArray arr = new JSONArray(body);
            if (arr.length() == 0) return null;
            JSONObject row = arr.getJSONObject(0);
            JSONObject prefs = row.optJSONObject("prefs");
            if (prefs == null) return null;
            JSONObject result = new JSONObject();
            result.put("criticalAlarm", prefs.optBoolean("criticalAlarm", true));
            result.put("dndEnabled", prefs.optBoolean("dndEnabled", false));
            result.put("dndStart", prefs.optString("dndStart", "23:00"));
            result.put("dndEnd", prefs.optString("dndEnd", "07:00"));
            return result;
        } catch (Exception e) {
            Log.w(TAG, "fetchUserPrefs error: " + e.getMessage());
            return null;
        }
    }

    private int scheduleDoses(Context ctx, JSONArray doses, JSONObject prefsOverride) throws JSONException {
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

            // Item #209 v0.2.1.9 Bug 1 fix — extrai patientName do embed PostgREST.
            // d.patients é JSONObject {name: "..."} OR null se paciente deletado.
            String patientName = "";
            JSONObject patientObj = d.optJSONObject("patients");
            if (patientObj != null) {
                patientName = patientObj.optString("name", "");
            }

            JSONObject entry = new JSONObject();
            entry.put("doseId", d.getString("id"));
            entry.put("medName", d.optString("medName", "Dose"));
            entry.put("unit", d.optString("unit", ""));
            entry.put("patientName", patientName);
            entry.put("scheduledAt", d.optString("scheduledAt", ""));
            groups.get(minute).put(entry);
            doseIdsByMinute.get(minute).add(d.getString("id"));
        }

        // Audit batch_start
        try {
            JSONObject meta = new JSONObject();
            meta.put("groupsCount", groups.size());
            meta.put("dosesCount", doses.length());
            meta.put("horizonHours", HORIZON_HOURS);
            AlarmAuditLogger.logBatch(ctx, "java_worker", "batch_start", meta);
        } catch (JSONException ignore) {}

        int scheduled = 0;
        for (Map.Entry<Long, JSONArray> e : groups.entrySet()) {
            // group key: doseIds concat sorted (mesmo do JS)
            Set<String> ids = doseIdsByMinute.get(e.getKey());
            String[] sorted = ids.toArray(new String[0]);
            java.util.Arrays.sort(sorted);
            String groupKey = String.join("|", sorted);
            int id = AlarmScheduler.idFromString(groupKey);

            // #215 v0.2.3.0 — delega ao helper unificado scheduleDoseAlarm.
            // prefsOverride do fetchUserPrefs DB (autoritativo) fix race-condition.
            AlarmScheduler.Branch branch = AlarmScheduler.scheduleDoseAlarm(ctx, id, e.getKey(), e.getValue(), prefsOverride);
            scheduled++;

            // Audit: log per dose do grupo (incluindo branch escolhida)
            JSONArray groupDoses = e.getValue();
            for (int gi = 0; gi < groupDoses.length(); gi++) {
                try {
                    JSONObject doseEntry = groupDoses.getJSONObject(gi);
                    JSONObject meta = new JSONObject();
                    meta.put("groupId", id);
                    meta.put("groupSize", groupDoses.length());
                    meta.put("triggerAtMs", e.getKey());
                    meta.put("branch", branch.name().toLowerCase());
                    meta.put("source_scenario", "workmanager_6h");
                    AlarmAuditLogger.logScheduled(
                        ctx, "java_worker",
                        doseEntry.optString("doseId", null),
                        doseEntry.optString("scheduledAt", null),
                        doseEntry.optString("patientName", null),
                        doseEntry.optString("medName", null),
                        meta
                    );
                } catch (JSONException ignore) {}
            }
        }

        // Audit batch_end
        try {
            JSONObject meta = new JSONObject();
            meta.put("scheduledGroups", scheduled);
            meta.put("totalGroups", groups.size());
            AlarmAuditLogger.logBatch(ctx, "java_worker", "batch_end", meta);
        } catch (JSONException ignore) {}

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
