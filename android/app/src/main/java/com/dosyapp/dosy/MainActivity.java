package com.dosyapp.dosy;

import android.content.Intent;
import android.os.Bundle;

import com.dosyapp.dosy.plugins.criticalalarm.CriticalAlarmPlugin;
import com.dosyapp.dosy.plugins.criticalalarm.AlarmService;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CriticalAlarmPlugin.class);
        super.onCreate(savedInstanceState);
        handleAlarmAction(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleAlarmAction(intent);
    }

    /**
     * Processa intents do AlarmActivity / notif persistente.
     *
     *   openDoseId  → tap na notificação persistente — abre DoseModal
     *   alarmAction → tap em botão dentro do AlarmActivity (legado, não usado mais)
     */
    private void handleAlarmAction(Intent intent) {
        if (intent == null) return;

        String openDoseIds = intent.getStringExtra("openDoseIds");
        if (openDoseIds != null) {
            intent.removeExtra("openDoseIds");
            // User tapped notif → silence active alarm
            AlarmService.stopActiveAlarm(this);
            postJsEvent("dosy:openDoses", "doseIds", openDoseIds);
            return;
        }

        String openDoseId = intent.getStringExtra("openDoseId");
        if (openDoseId != null) {
            intent.removeExtra("openDoseId");
            AlarmService.stopActiveAlarm(this);
            postJsEvent("dosy:openDose", "doseId", openDoseId);
            return;
        }
    }

    private void postJsEvent(String eventName, String key, String value) {
        // Set global var IMMEDIATELY (covers cold start: JS reads on mount)
        // Plus dispatch event with retries (covers warm start: listener already bound)
        String safeVal = value.replace("'", "\\'");
        String varName = key.equals("doseIds") ? "__dosyPendingDoseIds" : "__dosyPendingDoseId";
        String setVar = String.format("window.%s = '%s';", varName, safeVal);
        String dispatch = String.format(
            "window.dispatchEvent(new CustomEvent('%s', { detail: { %s: '%s' } }));",
            eventName, key, safeVal
        );
        String js = setVar + dispatch;
        postJsRaw(js, 300);
        postJsRaw(js, 1500);
        postJsRaw(js, 3500);
    }

    private void postJsRaw(String js, long delayMs) {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        getBridge().getWebView().postDelayed(
            () -> getBridge().getWebView().evaluateJavascript(js, null),
            delayMs
        );
    }
}
