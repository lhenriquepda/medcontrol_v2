package com.dosyapp.dosy.plugins.criticalalarm;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * AlarmAuditLogger — captura eventos de agendamento/cancelamento de alarme
 * pelos paths nativos (Worker, FCM data, AlarmReceiver) e envia pra Supabase
 * tabela `medcontrol.alarm_audit_log`.
 *
 * Feature opt-in: user_id deve estar em `alarm_audit_config.enabled=true`.
 * RLS DB filtra via auth.uid() + EXISTS check. Insert silenciosamente falha
 * se config OFF — sem necessidade de cache local enabled flag (server-side RLS
 * resolve).
 *
 * Performance: roda em thread separada (cached executor). Não bloqueia hot
 * path do AlarmScheduler. Silent-fail garantido.
 *
 * #209 v0.2.2.0 — debug duplicidade / inconsistência arquitetura 5 paths.
 */
public class AlarmAuditLogger {
    private static final String TAG = "AlarmAuditLogger";
    private static final String SYNC_PREFS = "dosy_sync_credentials";

    // Executor compartilhado pra evitar criar thread por evento.
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();

    private AlarmAuditLogger() {}

    /**
     * Loga evento `scheduled` de dose individual.
     *
     * @param ctx Android context
     * @param source 'java_worker' | 'java_fcm_received' | 'java_alarm_scheduler'
     * @param doseId UUID da dose (string)
     * @param scheduledAtIso ISO-8601 timestamp da dose
     * @param patientName nome paciente ou null
     * @param medName nome medicação ou null
     * @param metadata JSONObject livre debug ou null
     */
    public static void logScheduled(Context ctx, String source, String doseId,
                                    String scheduledAtIso, String patientName,
                                    String medName, JSONObject metadata) {
        logEvent(ctx, source, "scheduled", doseId, scheduledAtIso, patientName, medName, metadata);
    }

    /**
     * Loga evento `cancelled` (DOSE removida ou status mudou).
     */
    public static void logCancelled(Context ctx, String source, String doseId,
                                    JSONObject metadata) {
        logEvent(ctx, source, "cancelled", doseId, null, null, null, metadata);
    }

    /**
     * Loga evento `fired_received` (AlarmReceiver.onReceive disparou).
     */
    public static void logFired(Context ctx, String source, String doseId,
                                String scheduledAtIso, String patientName,
                                String medName, JSONObject metadata) {
        logEvent(ctx, source, "fired_received", doseId, scheduledAtIso, patientName, medName, metadata);
    }

    /**
     * Loga evento `batch_start` ou `batch_end` (sem dose individual).
     */
    public static void logBatch(Context ctx, String source, String action,
                                JSONObject metadata) {
        logEvent(ctx, source, action, null, null, null, null, metadata);
    }

    private static void logEvent(final Context ctx, final String source,
                                 final String action, final String doseId,
                                 final String scheduledAtIso, final String patientName,
                                 final String medName, final JSONObject metadata) {
        EXECUTOR.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    SharedPreferences sp = ctx.getSharedPreferences(SYNC_PREFS, Context.MODE_PRIVATE);
                    String url = sp.getString("supabase_url", null);
                    String anon = sp.getString("anon_key", null);
                    String userId = sp.getString("user_id", null);
                    String schema = sp.getString("schema", "medcontrol");
                    String accessToken = sp.getString("access_token", null);

                    if (url == null || anon == null || userId == null || accessToken == null) {
                        return;
                    }

                    JSONObject row = new JSONObject();
                    row.put("user_id", userId);
                    row.put("device_id", android.os.Build.MODEL + " (" + android.os.Build.MANUFACTURER + ")");
                    if (doseId != null) row.put("dose_id", doseId);
                    row.put("source", source);
                    row.put("action", action);
                    if (scheduledAtIso != null) row.put("scheduled_at", scheduledAtIso);
                    if (patientName != null) row.put("patient_name", patientName);
                    if (medName != null) row.put("med_name", medName);
                    row.put("metadata", metadata != null ? metadata : new JSONObject());

                    URL endpoint = new URL(url + "/rest/v1/alarm_audit_log");
                    HttpURLConnection conn = (HttpURLConnection) endpoint.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("apikey", anon);
                    conn.setRequestProperty("Authorization", "Bearer " + accessToken);
                    conn.setRequestProperty("Content-Type", "application/json");
                    conn.setRequestProperty("Content-Profile", schema);
                    conn.setRequestProperty("Prefer", "return=minimal");
                    conn.setDoOutput(true);
                    conn.setConnectTimeout(8000);
                    conn.setReadTimeout(8000);

                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(row.toString().getBytes(StandardCharsets.UTF_8));
                    }

                    int status = conn.getResponseCode();
                    if (status >= 400) {
                        Log.d(TAG, "audit insert non-2xx status=" + status + " (provavelmente config OFF) action=" + action);
                    }
                    conn.disconnect();
                } catch (JSONException | IOException e) {
                    // silent fail — audit nunca pode interromper alarme
                } catch (Exception e) {
                    Log.d(TAG, "audit unexpected: " + e.getMessage());
                }
            }
        });
    }
}
