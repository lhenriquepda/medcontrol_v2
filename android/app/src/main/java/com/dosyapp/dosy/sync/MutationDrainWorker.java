package com.dosyapp.dosy.sync;

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
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

/**
 * MutationDrainWorker — v0.2.8.0 Worker Native
 *
 * Drena `pending_mutations` queue (SharedPreferences "CapacitorStorage") postando
 * em Supabase RPC v3 idempotentes. Roda a cada 15min via WorkManager
 * PeriodicWorkRequest, INDEPENDENTE da WebView/JavaScript estar viva.
 *
 * Motivação (Plano_Worker_Native_v028.md):
 *   v0.2.7.0 resolveu B102 em 90% dos casos via drain JS no boot/resume.
 *   Resto 10%: user marca dose com app suspended → JS timers não disparam →
 *   queue stuck até user reabrir. Worker nativo cobre esse último caminho.
 *
 * Constraints:
 *   - NetworkType.CONNECTED (sem rede = pula cycle)
 *   - SEM RequiresBatteryNotLow (decisão user #4 — healthcare > bateria)
 *   - 15min mínimo (limite WorkManager — decisão user #1)
 *
 * Auth (decisão user #2 — Opção B):
 *   - Lê access_token de `dosy_sync_credentials` (gravado pelo CriticalAlarmPlugin)
 *   - Se expirado: tenta refresh nativo via POST /auth/v1/token?grant_type=refresh_token
 *   - Persist tokens novos em SharedPreferences (atomicamente apply())
 *   - JS e Worker compartilham mesma fonte de tokens — race controlada
 *
 * Retry (decisão user #3):
 *   - Network/IOException: break loop (não incrementa retry) — próximo cycle tenta
 *   - 401: refresh + retry no próximo cycle
 *   - Outros HTTP errors: incrementRetry. Se ≥3, remove da queue.
 *   - 200/204 com ok:true ou code:409: remove (sucesso ou conflict aceito)
 *
 * Idempotência:
 *   RPCs v3 fazem lookup mutation_log pelo request_id PK. Re-execução = no-op
 *   server-side. Race JS↔Worker drenando mesma entry custa 1 RPC extra (~1KB).
 */
public class MutationDrainWorker extends Worker {
    private static final String TAG = "MutationDrainWorker";
    private static final String SYNC_PREFS = "dosy_sync_credentials";
    private static final int MAX_ENTRIES_PER_CYCLE = 20;
    private static final int CONNECT_TIMEOUT_MS = 10_000;
    private static final int READ_TIMEOUT_MS = 15_000;
    /** Margem antes da expiry pra acionar refresh (5min como DoseSyncWorker). */
    private static final long EXP_SAFETY_MARGIN_MS = 300_000L;
    /** Decisão user #3: descarta entry após 3× erro real (não-network, não-auth). */
    private static final int MAX_RETRIES_REAL_ERROR = 3;

    public MutationDrainWorker(@NonNull Context ctx, @NonNull WorkerParameters params) {
        super(ctx, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        SharedPreferences syncPrefs = ctx.getSharedPreferences(SYNC_PREFS, Context.MODE_PRIVATE);
        SharedPreferences mutPrefs = ctx.getSharedPreferences(MutationQueueStore.PREFS_NAME, Context.MODE_PRIVATE);

        // Quick exit: queue vazia → zero rede, return.
        JSONArray queue = MutationQueueStore.read(mutPrefs);
        if (queue.length() == 0) {
            Log.d(TAG, "queue vazia — skip cycle");
            return Result.success();
        }

        String supabaseUrl = syncPrefs.getString("supabase_url", null);
        String anonKey = syncPrefs.getString("anon_key", null);
        String schema = syncPrefs.getString("schema", "medcontrol");
        String accessToken = syncPrefs.getString("access_token", null);
        long accessTokenExp = syncPrefs.getLong("access_token_exp_ms", 0L);

        if (supabaseUrl == null || anonKey == null) {
            Log.d(TAG, "credenciais ausentes — pula cycle (user ainda não logou?)");
            return Result.success();
        }

        // Token expirado/quase-expirado → tenta refresh nativo (Opção B do user).
        long now = System.currentTimeMillis();
        boolean needsRefresh = accessToken == null
            || (accessTokenExp > 0 && (now + EXP_SAFETY_MARGIN_MS) >= accessTokenExp);
        if (needsRefresh) {
            String refreshed = refreshAccessTokenNative(supabaseUrl, anonKey, syncPrefs);
            if (refreshed == null) {
                Log.d(TAG, "refresh token fail — pula cycle, próximo tenta");
                return Result.success();
            }
            accessToken = refreshed;
            Log.d(TAG, "token refreshed via refresh nativo (Opção B)");
        }

        Log.d(TAG, "drain start — " + queue.length() + " entries pendentes");
        int processed = 0;
        int kept = 0;
        int dropped = 0;

        for (int i = 0; i < queue.length() && processed < MAX_ENTRIES_PER_CYCLE; i++) {
            JSONObject entry = queue.optJSONObject(i);
            if (entry == null) continue;

            String requestId = entry.optString("requestId", null);
            String action = entry.optString("action", null);
            if (requestId == null || action == null) {
                // Entry corrompida — remove pra não acumular lixo
                if (requestId != null) MutationQueueStore.removeEntry(mutPrefs, requestId);
                continue;
            }

            DrainResult res = postRpc(supabaseUrl, anonKey, schema, accessToken, entry);

            if (res == DrainResult.SUCCESS) {
                MutationQueueStore.removeEntry(mutPrefs, requestId);
                processed++;
            } else if (res == DrainResult.AUTH_FAIL) {
                // 401 inesperado (acabamos de refreshar) — tenta refresh extra 1×
                String refreshed = refreshAccessTokenNative(supabaseUrl, anonKey, syncPrefs);
                if (refreshed != null) {
                    accessToken = refreshed;
                    // Retry mesma entry no próximo cycle (break aqui pra não loop)
                    Log.d(TAG, "auth fail mid-drain → refreshed, próximo cycle retry");
                } else {
                    Log.w(TAG, "auth fail + refresh fail — pula resto, próximo cycle tenta");
                }
                break;
            } else if (res == DrainResult.NETWORK_ERROR) {
                // Network transitório — break loop, próximo cycle tenta
                Log.d(TAG, "network error — break loop, próximo cycle");
                kept++;
                break;
            } else {
                // REAL_ERROR — incrementRetry, descarta se ≥3
                int retries = MutationQueueStore.incrementRetry(mutPrefs, requestId);
                if (retries >= MAX_RETRIES_REAL_ERROR) {
                    Log.w(TAG, "entry descartada após " + retries + " tentativas: " + requestId);
                    MutationQueueStore.removeEntry(mutPrefs, requestId);
                    dropped++;
                } else {
                    kept++;
                }
            }
        }

        Log.d(TAG, "drain end — processed=" + processed + " kept=" + kept + " dropped=" + dropped
            + " remaining=" + MutationQueueStore.size(mutPrefs));
        return Result.success();
    }

    /**
     * POST RPC v3 idempotente em /rest/v1/rpc/{action}_dose_v3.
     * Body: { p_request_id, p_dose_id, p_actual_time?, p_observation? }
     */
    private DrainResult postRpc(String supabaseUrl, String anonKey, String schema,
                                 String accessToken, JSONObject entry) {
        String action = entry.optString("action", null);
        String doseId = entry.optString("doseId", null);
        String requestId = entry.optString("requestId", null);
        JSONObject payload = entry.optJSONObject("payload");
        if (payload == null) payload = new JSONObject();

        String rpcName;
        switch (action) {
            case "confirm": rpcName = "confirm_dose_v3"; break;
            case "skip":    rpcName = "skip_dose_v3";    break;
            case "undo":    rpcName = "undo_dose_v3";    break;
            default:
                Log.w(TAG, "action inválida: " + action + " — trata como REAL_ERROR");
                return DrainResult.REAL_ERROR;
        }

        HttpURLConnection conn = null;
        try {
            URL url = new URL(supabaseUrl + "/rest/v1/rpc/" + rpcName);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("apikey", anonKey);
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Content-Profile", schema);
            conn.setRequestProperty("Accept", "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(READ_TIMEOUT_MS);

            JSONObject body = new JSONObject();
            body.put("p_request_id", requestId);
            body.put("p_dose_id", doseId);
            if ("confirm".equals(action)) {
                String actualTime = payload.optString("actualTime", null);
                if (actualTime == null || actualTime.isEmpty()) {
                    actualTime = Instant.now().toString();
                }
                body.put("p_actual_time", actualTime);
            }
            if (payload.has("observation")) {
                body.put("p_observation", payload.optString("observation", ""));
            }

            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }

            int code = conn.getResponseCode();
            if (code == 401 || code == 403) {
                return DrainResult.AUTH_FAIL;
            }
            if (code >= 200 && code < 300) {
                // RPC v3 retorna JSONB {ok, dose} ou {ok:false, code:409, current_state}.
                // Both 200 e 204 são success no transport — parsea body se houver.
                String responseBody = readResponse(conn);
                if (responseBody == null || responseBody.isEmpty()) {
                    return DrainResult.SUCCESS;
                }
                try {
                    // RPC pode retornar array (PostgREST padrão) ou objeto direto.
                    Object parsed = new org.json.JSONTokener(responseBody).nextValue();
                    JSONObject result;
                    if (parsed instanceof JSONArray) {
                        JSONArray arr = (JSONArray) parsed;
                        result = arr.length() > 0 ? arr.optJSONObject(0) : null;
                    } else if (parsed instanceof JSONObject) {
                        result = (JSONObject) parsed;
                    } else {
                        result = null;
                    }
                    if (result == null) return DrainResult.SUCCESS;

                    // ok:true → sucesso. ok:false com code:409 → conflict aceito (server tem o estado).
                    // ok:false com outros codes → erro lógico (retry).
                    boolean ok = result.optBoolean("ok", true);
                    int errCode = result.optInt("code", 0);
                    if (ok || errCode == 409) {
                        return DrainResult.SUCCESS;
                    }
                    Log.w(TAG, "RPC logical fail code=" + errCode + " req=" + requestId);
                    return DrainResult.REAL_ERROR;
                } catch (JSONException e) {
                    // Body não-JSON parseable mas HTTP 200 — tratamos como sucesso pra não retry forever
                    Log.w(TAG, "RPC response não-JSON mas HTTP " + code + ": " + e.getMessage());
                    return DrainResult.SUCCESS;
                }
            }
            // HTTP 4xx/5xx (não-auth) → REAL_ERROR (incrementRetry)
            Log.w(TAG, "RPC HTTP " + code + " req=" + requestId);
            return DrainResult.REAL_ERROR;
        } catch (IOException e) {
            // Connection refused, timeout, DNS fail — network transitório
            Log.d(TAG, "RPC IOException: " + e.getMessage());
            return DrainResult.NETWORK_ERROR;
        } catch (JSONException e) {
            Log.w(TAG, "RPC body build fail: " + e.getMessage());
            return DrainResult.REAL_ERROR;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    /**
     * Refresh nativo (Opção B do user) — POST /auth/v1/token?grant_type=refresh_token.
     * Em sucesso, persiste new tokens em syncPrefs atomicamente (apply()).
     *
     * @return novo access_token, ou null se falhar.
     */
    private String refreshAccessTokenNative(String supabaseUrl, String anonKey, SharedPreferences syncPrefs) {
        String refreshToken = syncPrefs.getString("refresh_token", null);
        if (refreshToken == null || refreshToken.isEmpty()) {
            Log.d(TAG, "refresh_token ausente — não pode refreshar");
            return null;
        }

        HttpURLConnection conn = null;
        try {
            URL url = new URL(supabaseUrl + "/auth/v1/token?grant_type=refresh_token");
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("apikey", anonKey);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Accept", "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(READ_TIMEOUT_MS);

            JSONObject body = new JSONObject();
            body.put("refresh_token", refreshToken);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }

            int code = conn.getResponseCode();
            if (code != 200) {
                Log.w(TAG, "refresh HTTP " + code);
                return null;
            }

            String responseBody = readResponse(conn);
            JSONObject json = new JSONObject(responseBody);
            String newAccessToken = json.optString("access_token", null);
            String newRefreshToken = json.optString("refresh_token", null);
            long expiresIn = json.optLong("expires_in", 3600L); // segundos
            if (newAccessToken == null || newRefreshToken == null) {
                Log.w(TAG, "refresh response missing tokens");
                return null;
            }
            long expMs = System.currentTimeMillis() + (expiresIn * 1000L);

            // apply() é atomic — JS lendo simultaneamente vê estado consistente
            syncPrefs.edit()
                .putString("access_token", newAccessToken)
                .putString("refresh_token", newRefreshToken)
                .putLong("access_token_exp_ms", expMs)
                .apply();

            return newAccessToken;
        } catch (IOException e) {
            Log.w(TAG, "refresh IOException: " + e.getMessage());
            return null;
        } catch (JSONException e) {
            Log.w(TAG, "refresh JSON fail: " + e.getMessage());
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private String readResponse(HttpURLConnection conn) throws IOException {
        InputStream is = conn.getResponseCode() < 400 ? conn.getInputStream() : conn.getErrorStream();
        if (is == null) return "";
        try (BufferedReader r = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = r.readLine()) != null) sb.append(line);
            return sb.toString();
        }
    }

    private enum DrainResult {
        SUCCESS,
        AUTH_FAIL,
        NETWORK_ERROR,
        REAL_ERROR
    }
}
