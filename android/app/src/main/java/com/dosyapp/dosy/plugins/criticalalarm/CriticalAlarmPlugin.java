package com.dosyapp.dosy.plugins.criticalalarm;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * CriticalAlarmPlugin — Critical medication reminders that behave like an alarm clock.
 *
 * Uses AlarmManager.setAlarmClock() to bypass Doze mode and ensure delivery.
 * AlarmReceiver posts a notification with setFullScreenIntent() — system launches
 * AlarmActivity (BAL-exempt) on locked screen, or shows heads-up notif when unlocked.
 *
 * JS API:
 *   schedule({ id, at, doseId, medName, unit, patientName })          // single dose (legacy)
 *   scheduleGroup({ id, at, doses: [{doseId, medName, unit, patientName}, ...] })  // grouped
 *   cancel({ id })
 *   cancelAll()
 *   isEnabled()
 *   openExactAlarmSettings()
 */
@CapacitorPlugin(name = "CriticalAlarm")
public class CriticalAlarmPlugin extends Plugin {

    private static final String PREFS = "dosy_critical_alarms";
    private static final String KEY_SCHEDULED = "scheduled_alarms";

    /**
     * v0.2.3.1 Plano A — scheduleTrayGroup: agenda tray notification puro Java
     * (sem alarme fullscreen). Substitui Capacitor LocalNotifications.schedule
     * pra trays de dose. JS scheduler.js refactor unifica em Java pra eliminar
     * dual tray race (M2 + M3 coexistindo).
     */
    @PluginMethod
    public void scheduleTrayGroup(PluginCall call) {
        Integer id = call.getInt("id");
        String at = call.getString("at");
        String channelId = call.getString("channelId", "dosy_tray");
        JSArray dosesArr = call.getArray("doses");
        if (id == null || at == null || dosesArr == null) {
            call.reject("missing required: id, at, doses[]");
            return;
        }
        long triggerAt;
        try {
            triggerAt = java.time.Instant.parse(at).toEpochMilli();
        } catch (Exception e) {
            call.reject("invalid 'at': " + at);
            return;
        }
        if (triggerAt <= System.currentTimeMillis()) {
            call.reject("'at' must be in the future");
            return;
        }
        JSONArray doses = new JSONArray();
        for (int i = 0; i < dosesArr.length(); i++) {
            try {
                JSONObject src = dosesArr.getJSONObject(i);
                JSONObject d = new JSONObject();
                d.put("doseId", src.optString("doseId", ""));
                d.put("medName", src.optString("medName", "Dose"));
                d.put("unit", src.optString("unit", ""));
                d.put("patientName", src.optString("patientName", ""));
                d.put("scheduledAt", src.optString("scheduledAt", ""));
                doses.put(d);
            } catch (JSONException ignored) {}
        }
        AlarmScheduler.scheduleTrayGroup(getContext(), id, triggerAt, doses, channelId);
        JSObject ret = new JSObject();
        ret.put("scheduled", true);
        ret.put("id", id);
        ret.put("count", doses.length());
        call.resolve(ret);
    }

    /**
     * v0.2.3.1 Plano A — cancelTrayGroup: cancela tray PendingIntent + remove persisted.
     */
    @PluginMethod
    public void cancelTrayGroup(PluginCall call) {
        Integer id = call.getInt("id");
        if (id == null) {
            call.reject("id required");
            return;
        }
        AlarmScheduler.cancelTrayGroup(getContext(), id);
        call.resolve();
    }

    /**
     * v0.2.3.1 Plano A — cancelAllTrays: rescheduleAll cleanup helper.
     */
    @PluginMethod
    public void cancelAllTrays(PluginCall call) {
        AlarmScheduler.cancelAllTrays(getContext());
        call.resolve();
    }

    @PluginMethod
    public void scheduleGroup(PluginCall call) {
        Integer id = call.getInt("id");
        String at = call.getString("at");
        JSArray dosesArr = call.getArray("doses");

        if (id == null || at == null || dosesArr == null || dosesArr.length() == 0) {
            call.reject("missing required: id, at, doses[]");
            return;
        }

        JSONArray doses = new JSONArray();
        for (int i = 0; i < dosesArr.length(); i++) {
            try {
                JSONObject src = dosesArr.getJSONObject(i);
                JSONObject d = new JSONObject();
                d.put("doseId", src.optString("doseId", ""));
                d.put("medName", src.optString("medName", "Dose"));
                d.put("unit", src.optString("unit", ""));
                d.put("patientName", src.optString("patientName", ""));
                d.put("scheduledAt", src.optString("scheduledAt", ""));
                doses.put(d);
            } catch (JSONException ignored) {}
        }

        scheduleInternal(call, id, at, doses);
    }

    private void scheduleInternal(PluginCall call, int id, String at, JSONArray doses) {
        long triggerAt;
        try {
            triggerAt = java.time.Instant.parse(at).toEpochMilli();
        } catch (Exception e) {
            call.reject("invalid 'at' (expected ISO 8601): " + at);
            return;
        }

        if (triggerAt <= System.currentTimeMillis()) {
            call.reject("'at' must be in the future");
            return;
        }

        // Item #081 (release v0.1.7.1) — delegate to AlarmScheduler helper
        // (mesmo código usado pelo DoseSyncWorker em background).
        boolean ok = AlarmScheduler.scheduleDose(getContext(), id, triggerAt, doses);
        if (!ok) {
            call.reject("schedule failed (past trigger or permission)");
            return;
        }

        JSObject ret = new JSObject();
        ret.put("scheduled", true);
        ret.put("id", id);
        ret.put("count", doses.length());
        call.resolve(ret);
    }

    /**
     * Item #081 — armazena credentials Supabase em SharedPreferences pra
     * DoseSyncWorker poder fazer fetch autenticado em background.
     * Chamado pelo JS após login (useAuth.jsx onAuthStateChange SIGNED_IN).
     *
     * Item #083.6 — adiciona device_id estável (UUID v4 gerado uma vez,
     * persiste). Usado por AlarmAuditLogger.device_id cross-source consistency.
     */
    @PluginMethod
    public void setSyncCredentials(PluginCall call) {
        String url = call.getString("supabaseUrl");
        String anonKey = call.getString("anonKey");
        String userId = call.getString("userId");
        String refreshToken = call.getString("refreshToken");
        String schema = call.getString("schema", "medcontrol");
        // Item #205 (release v0.2.1.8) — access_token + exp epoch ms opcionais.
        // Quando passados, native NÃO precisa chamar /auth/v1/token?grant_type=refresh_token
        // (storm xx:00 fix). JS fica como ÚNICA fonte de refresh.
        String accessToken = call.getString("accessToken");
        Long accessTokenExp = null;
        if (call.hasOption("accessTokenExp")) {
            try { accessTokenExp = call.getLong("accessTokenExp"); } catch (Exception ignored) {}
        }

        if (url == null || anonKey == null || userId == null || refreshToken == null) {
            call.reject("missing: supabaseUrl, anonKey, userId, refreshToken");
            return;
        }

        SharedPreferences sp = getContext().getSharedPreferences("dosy_sync_credentials", Context.MODE_PRIVATE);

        // device_id estável: gera UUID na primeira vez, persiste pra sempre
        String deviceId = sp.getString("device_id", null);
        if (deviceId == null) {
            deviceId = java.util.UUID.randomUUID().toString();
        }

        // Item #085 (release v0.1.7.3) — toggle Alarme Crítico do user.
        // Se passado, atualiza SP. Senão, mantém valor existente (default true).
        boolean criticalAlarmEnabled = sp.getBoolean("critical_alarm_enabled", true);
        if (call.hasOption("criticalAlarmEnabled")) {
            criticalAlarmEnabled = call.getBoolean("criticalAlarmEnabled", true);
        }

        SharedPreferences.Editor ed = sp.edit()
            .putString("supabase_url", url)
            .putString("anon_key", anonKey)
            .putString("user_id", userId)
            .putString("refresh_token", refreshToken)
            .putString("schema", schema)
            .putString("device_id", deviceId)
            .putBoolean("critical_alarm_enabled", criticalAlarmEnabled);
        if (accessToken != null) ed.putString("access_token", accessToken);
        if (accessTokenExp != null) ed.putLong("access_token_exp_ms", accessTokenExp);
        ed.apply();

        JSObject ret = new JSObject();
        ret.put("deviceId", deviceId);
        call.resolve(ret);
    }

    /**
     * Item #085 (release v0.1.7.3) — atualiza só o toggle Alarme Crítico em
     * SharedPreferences. Chamado pelo useUserPrefs.mutationFn quando user
     * mexe no toggle em Ajustes (sem precisar redo full setSyncCredentials).
     * DoseSyncWorker + DosyMessagingService leem essa flag antes de agendar.
     *
     * #215 v0.2.3.0 — também grava em `dosy_user_prefs` SharedPreferences
     * (namespace separado) pra AlarmScheduler.scheduleDoseAlarm helper unificado ler.
     */
    @PluginMethod
    public void setCriticalAlarmEnabled(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled");
        if (enabled == null) {
            call.reject("enabled required (boolean)");
            return;
        }
        // Legacy namespace (consumido por DoseSyncWorker + DosyMessagingService)
        SharedPreferences sp = getContext().getSharedPreferences("dosy_sync_credentials", Context.MODE_PRIVATE);
        sp.edit().putBoolean("critical_alarm_enabled", enabled).apply();
        // #215 namespace unificado (consumido por AlarmScheduler.scheduleDoseAlarm)
        SharedPreferences spPrefs = getContext().getSharedPreferences("dosy_user_prefs", Context.MODE_PRIVATE);
        spPrefs.edit().putBoolean("critical_alarm_enabled", enabled).apply();
        call.resolve();
    }

    /**
     * #215 v0.2.3.0 — sincroniza prefs completas pro namespace `dosy_user_prefs`.
     * Chamado pelo useUserPrefs.mutationFn sempre que prefs mudam.
     * AlarmScheduler.scheduleDoseAlarm lê dali pra decidir branch.
     *
     * Payload esperado:
     *   { criticalAlarm: bool, dndEnabled: bool, dndStart: "HH:mm", dndEnd: "HH:mm" }
     */
    @PluginMethod
    public void syncUserPrefs(PluginCall call) {
        SharedPreferences sp = getContext().getSharedPreferences("dosy_user_prefs", Context.MODE_PRIVATE);
        SharedPreferences.Editor ed = sp.edit();
        if (call.hasOption("criticalAlarm")) {
            ed.putBoolean("critical_alarm_enabled", call.getBoolean("criticalAlarm", true));
        }
        if (call.hasOption("dndEnabled")) {
            ed.putBoolean("dnd_enabled", call.getBoolean("dndEnabled", false));
        }
        if (call.hasOption("dndStart")) {
            ed.putString("dnd_start", call.getString("dndStart", "23:00"));
        }
        if (call.hasOption("dndEnd")) {
            ed.putString("dnd_end", call.getString("dndEnd", "07:00"));
        }
        ed.apply();
        call.resolve();
    }

    /**
     * Item #083.6 — retorna device_id pra JS poder informar ao server
     * (alarm_audit_log device_id consistency cross-source).
     * Gera UUID se ausente (primeira chamada).
     */
    @PluginMethod
    public void getDeviceId(PluginCall call) {
        SharedPreferences sp = getContext().getSharedPreferences("dosy_sync_credentials", Context.MODE_PRIVATE);
        String deviceId = sp.getString("device_id", null);
        if (deviceId == null) {
            deviceId = java.util.UUID.randomUUID().toString();
            sp.edit().putString("device_id", deviceId).apply();
        }
        JSObject ret = new JSObject();
        ret.put("deviceId", deviceId);
        call.resolve(ret);
    }

    /**
     * Item #081 — limpa credentials (logout). DoseSyncWorker vai retornar
     * Result.success() sem fazer nada na próxima execução.
     */
    @PluginMethod
    public void clearSyncCredentials(PluginCall call) {
        getContext().getSharedPreferences("dosy_sync_credentials", Context.MODE_PRIVATE)
            .edit().clear().apply();
        call.resolve();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        Integer id = call.getInt("id");
        if (id == null) {
            call.reject("id required");
            return;
        }

        Context ctx = getContext();
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(ctx, AlarmReceiver.class);
        PendingIntent pi = PendingIntent.getBroadcast(
            ctx, id, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        am.cancel(pi);
        pi.cancel();

        // #215 v0.2.3.0 fix device-validation 2026-05-13: cancela tray backup
        // co-agendada (id + BACKUP_OFFSET). Mesma razão de cancelAll().
        int trayId = id + AlarmScheduler.BACKUP_OFFSET;
        Intent trayIntent = new Intent(ctx, TrayNotificationReceiver.class);
        PendingIntent trayPi = PendingIntent.getBroadcast(
            ctx, trayId, trayIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        am.cancel(trayPi);
        trayPi.cancel();

        removePersisted(id);

        call.resolve();
    }

    @PluginMethod
    public void cancelAll(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String json = prefs.getString(KEY_SCHEDULED, "[]");
        try {
            JSONArray arr = new JSONArray(json);
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                int id = obj.getInt("id");
                // Cancela AlarmReceiver (alarme nativo fullscreen)
                Intent intent = new Intent(ctx, AlarmReceiver.class);
                PendingIntent pi = PendingIntent.getBroadcast(
                    ctx, id, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );
                am.cancel(pi);
                pi.cancel();
                // #215 v0.2.3.0 fix device-validation 2026-05-13: também cancela
                // TrayNotificationReceiver backup co-agendada (id = groupId + BACKUP_OFFSET).
                // Sem isso, toggle Critical Alarm OFF deixa tray pendente em AlarmManager
                // → dispara junto com novo LocalNotification = 2 push duplicados.
                int trayId = id + AlarmScheduler.BACKUP_OFFSET;
                Intent trayIntent = new Intent(ctx, TrayNotificationReceiver.class);
                PendingIntent trayPi = PendingIntent.getBroadcast(
                    ctx, trayId, trayIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );
                am.cancel(trayPi);
                trayPi.cancel();
            }
        } catch (JSONException ignored) {}

        prefs.edit().remove(KEY_SCHEDULED).apply();
        call.resolve();
    }

    @PluginMethod
    public void isEnabled(PluginCall call) {
        JSObject ret = new JSObject();
        Context ctx = getContext();
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);

        boolean canSchedule = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            canSchedule = am.canScheduleExactAlarms();
        }
        ret.put("canScheduleExact", canSchedule);

        // Android 14+ (UPSIDE_DOWN_CAKE / SDK 34): full-screen intent requires explicit user grant.
        // Without this, AlarmReceiver fullScreenIntent silently degrades to heads-up only —
        // alarme não sobrepõe lock screen.
        boolean canFsi = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                try { canFsi = nm.canUseFullScreenIntent(); } catch (Exception ignored) {}
            }
        }
        ret.put("canFullScreenIntent", canFsi);
        call.resolve(ret);
    }

    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void openFullScreenIntentSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                getContext().startActivity(intent);
            } catch (Exception e) {
                call.reject("cannot open settings: " + e.getMessage());
                return;
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void openOverlaySettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
        intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
        } catch (Exception e) {
            call.reject("cannot open settings: " + e.getMessage());
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void openAppNotificationSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
        intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
        } catch (Exception e) {
            call.reject("cannot open settings: " + e.getMessage());
            return;
        }
        call.resolve();
    }

    /**
     * Item #207 (release v0.2.1.7) — battery optimization status.
     * isIgnoringBatteryOptimizations() retorna true se app está whitelist (alarmes garantidos).
     */
    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        JSObject ret = new JSObject();
        boolean ignoring = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                ignoring = pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
            }
        }
        ret.put("ignoring", ignoring);
        call.resolve(ret);
    }

    /**
     * Item #207 — solicita ao user adicionar Dosy à whitelist de battery optimization.
     * ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS abre dialog system com Sim/Não.
     * Play Store policy: permitido pra apps de medicação ("medication reminder").
     * User pode negar — caller deve checar isIgnoringBatteryOptimizations depois.
     */
    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            call.resolve();
            return;
        }
        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            // Fallback: abre tela de configurações genérica de battery optimization
            try {
                Intent fallback = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                fallback.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(fallback);
                call.resolve();
            } catch (Exception e2) {
                call.reject("cannot open battery optimization settings: " + e2.getMessage());
            }
        }
    }

    /**
     * Returns full permission status used by JS onboarding screen.
     * Each flag tells whether a critical-alarm-related permission is granted.
     */
    @PluginMethod
    public void checkPermissions(PluginCall call) {
        Context ctx = getContext();
        JSObject ret = new JSObject();

        // POST_NOTIFICATIONS — Android 13+
        boolean canPostNotifications = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            canPostNotifications = ContextCompat.checkSelfPermission(
                ctx, "android.permission.POST_NOTIFICATIONS"
            ) == PackageManager.PERMISSION_GRANTED;
        }
        ret.put("canPostNotifications", canPostNotifications);

        // SCHEDULE_EXACT_ALARM — Android 12+
        boolean canScheduleExact = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            canScheduleExact = am != null && am.canScheduleExactAlarms();
        }
        ret.put("canScheduleExact", canScheduleExact);

        // USE_FULL_SCREEN_INTENT — Android 14+ requires user grant
        boolean canFullScreenIntent = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            canFullScreenIntent = nm != null && nm.canUseFullScreenIntent();
        }
        ret.put("canFullScreenIntent", canFullScreenIntent);

        // SYSTEM_ALERT_WINDOW (overlay)
        boolean canDrawOverlay = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            canDrawOverlay = Settings.canDrawOverlays(ctx);
        }
        ret.put("canDrawOverlay", canDrawOverlay);

        // Notifications enabled at app level (master toggle)
        boolean notifsEnabled = true;
        try {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) notifsEnabled = nm.areNotificationsEnabled();
        } catch (Exception ignored) {}
        ret.put("notifsEnabled", notifsEnabled);

        // Item #207 — battery optimization whitelist (CRÍTICO Samsung One UI 7).
        // Sem isso OEM coloca app em bucket "rare/restricted" → alarms cancelados.
        boolean ignoringBatteryOpt = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                ignoringBatteryOpt = pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
            }
        }
        ret.put("ignoringBatteryOpt", ignoringBatteryOpt);

        // All required = ready (inclui battery optimization).
        ret.put("allGranted",
            canPostNotifications && canScheduleExact && canFullScreenIntent &&
            canDrawOverlay && notifsEnabled && ignoringBatteryOpt
        );

        call.resolve(ret);
    }

    private void persistAlarm(int id, long triggerAt, JSONArray doses) {
        Context ctx = getContext();
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String json = prefs.getString(KEY_SCHEDULED, "[]");
        try {
            JSONArray arr = new JSONArray(json);
            JSONArray filtered = new JSONArray();
            for (int i = 0; i < arr.length(); i++) {
                if (arr.getJSONObject(i).getInt("id") != id) {
                    filtered.put(arr.getJSONObject(i));
                }
            }
            JSONObject obj = new JSONObject();
            obj.put("id", id);
            obj.put("triggerAt", triggerAt);
            obj.put("doses", doses);
            filtered.put(obj);
            prefs.edit().putString(KEY_SCHEDULED, filtered.toString()).apply();
        } catch (JSONException ignored) {}
    }

    private void removePersisted(int id) {
        Context ctx = getContext();
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String json = prefs.getString(KEY_SCHEDULED, "[]");
        try {
            JSONArray arr = new JSONArray(json);
            JSONArray filtered = new JSONArray();
            for (int i = 0; i < arr.length(); i++) {
                if (arr.getJSONObject(i).getInt("id") != id) {
                    filtered.put(arr.getJSONObject(i));
                }
            }
            prefs.edit().putString(KEY_SCHEDULED, filtered.toString()).apply();
        } catch (JSONException ignored) {}
    }
}
