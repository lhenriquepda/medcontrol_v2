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

    @PluginMethod
    public void schedule(PluginCall call) {
        Integer id = call.getInt("id");
        String at = call.getString("at");
        String doseId = call.getString("doseId");
        String medName = call.getString("medName", "Dose");
        String unit = call.getString("unit", "");
        String patientName = call.getString("patientName", "");

        if (id == null || at == null || doseId == null) {
            call.reject("missing required: id, at, doseId");
            return;
        }

        // Wrap single dose as a 1-element group for unified handling
        JSONArray doses = new JSONArray();
        try {
            JSONObject d = new JSONObject();
            d.put("doseId", doseId);
            d.put("medName", medName);
            d.put("unit", unit);
            d.put("patientName", patientName);
            doses.put(d);
        } catch (JSONException e) {
            call.reject("json build error: " + e.getMessage());
            return;
        }

        scheduleInternal(call, id, at, doses);
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
     */
    @PluginMethod
    public void setSyncCredentials(PluginCall call) {
        String url = call.getString("supabaseUrl");
        String anonKey = call.getString("anonKey");
        String userId = call.getString("userId");
        String refreshToken = call.getString("refreshToken");
        String schema = call.getString("schema", "medcontrol");

        if (url == null || anonKey == null || userId == null || refreshToken == null) {
            call.reject("missing: supabaseUrl, anonKey, userId, refreshToken");
            return;
        }

        SharedPreferences sp = getContext().getSharedPreferences("dosy_sync_credentials", Context.MODE_PRIVATE);
        sp.edit()
            .putString("supabase_url", url)
            .putString("anon_key", anonKey)
            .putString("user_id", userId)
            .putString("refresh_token", refreshToken)
            .putString("schema", schema)
            .apply();

        call.resolve();
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
                Intent intent = new Intent(ctx, AlarmReceiver.class);
                PendingIntent pi = PendingIntent.getBroadcast(
                    ctx, id, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );
                am.cancel(pi);
                pi.cancel();
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

        // All required = ready
        ret.put("allGranted",
            canPostNotifications && canScheduleExact && canFullScreenIntent &&
            canDrawOverlay && notifsEnabled
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
