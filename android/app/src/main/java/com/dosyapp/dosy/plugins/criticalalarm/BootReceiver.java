package com.dosyapp.dosy.plugins.criticalalarm;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * BootReceiver — re-schedule persisted alarms after device reboot.
 * AlarmManager loses all alarms on boot — we restore them from SharedPreferences.
 */
public class BootReceiver extends BroadcastReceiver {

    private static final String PREFS = "dosy_critical_alarms";
    private static final String KEY_SCHEDULED = "scheduled_alarms";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;
        if (!action.equals(Intent.ACTION_BOOT_COMPLETED)
            && !action.equals(Intent.ACTION_LOCKED_BOOT_COMPLETED)
            && !action.equals(Intent.ACTION_MY_PACKAGE_REPLACED)) return;

        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String json = prefs.getString(KEY_SCHEDULED, "[]");
        try {
            JSONArray arr = new JSONArray(json);
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            long now = System.currentTimeMillis();
            JSONArray remaining = new JSONArray();

            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                long triggerAt = obj.getLong("triggerAt");
                if (triggerAt <= now) continue; // alarme passou enquanto device estava off
                int id = obj.getInt("id");

                Intent alarmIntent = new Intent(ctx, AlarmReceiver.class);
                alarmIntent.putExtra("id", id);
                alarmIntent.putExtra("doseId", obj.optString("doseId"));
                alarmIntent.putExtra("medName", obj.optString("medName"));
                alarmIntent.putExtra("unit", obj.optString("unit"));
                alarmIntent.putExtra("patientName", obj.optString("patientName"));

                PendingIntent pi = PendingIntent.getBroadcast(
                    ctx, id, alarmIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );

                Intent showIntent = new Intent(ctx, AlarmActivity.class);
                PendingIntent showPi = PendingIntent.getActivity(
                    ctx, id, showIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );

                am.setAlarmClock(new AlarmManager.AlarmClockInfo(triggerAt, showPi), pi);
                remaining.put(obj);
            }

            prefs.edit().putString(KEY_SCHEDULED, remaining.toString()).apply();
        } catch (JSONException ignored) {}
    }
}
