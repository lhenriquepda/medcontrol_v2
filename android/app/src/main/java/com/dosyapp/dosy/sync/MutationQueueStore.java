package com.dosyapp.dosy.sync;

import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * MutationQueueStore — v0.2.8.0 Worker Native
 *
 * Helper estático pra ler/escrever a fila de mutations pendentes em
 * SharedPreferences "CapacitorStorage" (mesma fonte que @capacitor/preferences
 * usa do lado JavaScript). Single source of truth: JS e Java enxergam a mesma
 * lista de entries.
 *
 * Entry schema (espelha pendingMutationsQueue.js):
 *   {
 *     requestId: String (UUID v4),
 *     doseId:    String,
 *     action:    String ("confirm"|"skip"|"undo"),
 *     payload:   JSONObject { actualTime?, observation? },
 *     createdAt: long (epoch ms),
 *     retryCount: int (default 0)
 *   }
 *
 * Concorrência: SharedPreferences.apply() é eventual consistent. Race entre
 * JS markDose.add e Worker.removeEntry é mitigada por idempotência server-side
 * (mutation_log PK request_id). Pior caso: 1 RPC extra com mesma requestId.
 */
public class MutationQueueStore {
    private static final String TAG = "MutationQueueStore";
    public static final String PREFS_NAME = "CapacitorStorage";
    public static final String KEY = "dosy_pending_mutations";

    /**
     * Lê queue da SharedPreferences. Retorna JSONArray vazio se ausente ou malformed.
     */
    public static synchronized JSONArray read(SharedPreferences prefs) {
        String json = prefs.getString(KEY, null);
        if (json == null || json.isEmpty()) return new JSONArray();
        try {
            return new JSONArray(json);
        } catch (JSONException e) {
            Log.w(TAG, "queue parse fail, returning empty: " + e.getMessage());
            return new JSONArray();
        }
    }

    /**
     * Persiste queue. Use apply() (async) — atomicity garantida pelo SharedPreferences.
     */
    public static synchronized void write(SharedPreferences prefs, JSONArray queue) {
        prefs.edit().putString(KEY, queue.toString()).apply();
    }

    /**
     * Remove entry por requestId. Idempotente (no-op se não existe).
     *
     * Implementação: re-lê queue antes de escrever pra pegar entries adicionadas
     * pelo JS entre o batch start do Worker e essa remove (race condition #1 do plan).
     */
    public static synchronized void removeEntry(SharedPreferences prefs, String requestId) {
        JSONArray current = read(prefs);
        JSONArray next = new JSONArray();
        for (int i = 0; i < current.length(); i++) {
            JSONObject entry = current.optJSONObject(i);
            if (entry == null) continue;
            if (requestId.equals(entry.optString("requestId", null))) continue;
            next.put(entry);
        }
        if (next.length() != current.length()) {
            write(prefs, next);
        }
    }

    /**
     * Incrementa retryCount da entry e retorna novo valor.
     * Decisão user #3: descartar entry só após 3× falha em erro real.
     *
     * @return novo retryCount, ou 0 se entry não encontrada
     */
    public static synchronized int incrementRetry(SharedPreferences prefs, String requestId) {
        JSONArray current = read(prefs);
        int newCount = 0;
        boolean found = false;
        for (int i = 0; i < current.length(); i++) {
            JSONObject entry = current.optJSONObject(i);
            if (entry == null) continue;
            if (requestId.equals(entry.optString("requestId", null))) {
                int prev = entry.optInt("retryCount", 0);
                newCount = prev + 1;
                try {
                    entry.put("retryCount", newCount);
                    found = true;
                } catch (JSONException e) {
                    Log.w(TAG, "incrementRetry put fail: " + e.getMessage());
                }
                break;
            }
        }
        if (found) write(prefs, current);
        return newCount;
    }

    /**
     * Quantidade de entries na queue.
     */
    public static int size(SharedPreferences prefs) {
        return read(prefs).length();
    }
}
