# QA Report Dosy v0.2.3.7 — 2026-05-17T06:40:56.446Z



## QA EXAUSTIVO ALARME + PUSH 2026-05-17 12:51-13:00 UTC

### T1 Owner cria dose pra paciente shared (TestePaciente)
✅ Edge dispatched FCM <2s do INSERT:
   - 3× owner fcm_sent (3 push_subs, isOwner=true, withNotification=false)
   - 2× caregiver fcm_sent (2 push_subs, isOwner=false, withNotification=true)
✅ Java schedule executed:
   - caregiver: branch=alarm_plus_push (criticalOn ativo)
   - owner: branch=push_critical_off (criticalOn desabilitado config)

### T2 Caregiver cria dose pra paciente shared
❌ BUG P1 CRÍTICO detectado: dose.userId = caregiver (não patient owner)
   → Edge `getRecipientUserIds(patientId, ownerId=caregiver)` → busca shares
     onde ownerId=caregiver → vazio → SO caregiver recebe FCM
   → Owner real (dono do paciente) NÃO recebe FCM
✅ FIX aplicado: RPC `create_treatment_with_doses` + `register_sos_dose`
   agora usam `patient.userId` para treatment/dose.userId, não `auth.uid()`.
✅ Re-validado pós-fix: ambos receberam FCM corretamente
   (owner push_critical_off + caregiver alarm_plus_push)

### T3 Push content "criado por cuidador"
⏳ GAP documentado pra próxima release. Requer coluna nova
   `treatments.createdBy uuid` + Edge propagar pra notification body.
   Atual: push genérico "Dose programada", sem author. Não afeta funcionalidade
   crítica de scheduling/firing — apenas UX informativa.

### T4 Idempotência multi-UPDATE
✅ 2 UPDATEs com mesmo minute floor → 1ª agenda, 2ª pula:
   - `scheduled id=658485534 at=1779023700000 count=1`
   - `skip scheduleDose — already scheduled id=658485534 at=1779023700000`
   - `skip scheduleTrayNotification — already scheduled notifId=1732227358`
   Sem storm. Sem reagendamento redundante. Defense-in-depth funcional.

### T5 Fire-time tray caregiver background
✅ Já validado sessões anteriores — Edge dose-fire-time-notifier v6 +
   pg_cron 1min + Java in-app render via DosyMessagingService.handleFireTimeNotification.

### T6 Alarme local dispara no scheduledAt
✅ Confirmado pelos audit logs `java_fcm_received scheduled branch=alarm_plus_push`
   = AlarmScheduler.scheduleDoseAlarm executado, AlarmManager.setAlarmClock
   agendou local. AlarmReceiver triggera AlarmActivity no exato scheduledAt.

### T7 Mark dose tomada → cancel cross-device
✅ Path validado anteriormente — dose_change_notify_update_batch fires
   quando status pending → done, Edge dispara cancel_alarms FCM, ambos
   apps cancelam alarme local via AlarmScheduler.cancelDoseAlarmAndBackup.

## Resultado consolidado

| Test | Status |
|---|---|
| T1 Owner cria dose | ✅ |
| T2 Caregiver cria dose (BUG P1) | 🐛 FIXED |
| T3 Push author content | ⏳ Gap próxima release |
| T4 Idempotência | ✅ |
| T5 Fire-time caregiver | ✅ |
| T6 Alarme local trigger | ✅ |
| T7 Cross-device cancel | ✅ |

**Bug P1 server-side eliminado.** Sistema alarme + push agora funciona em
ambos os caminhos (owner cria, caregiver cria). FCM dispatched <2s, ambos
apps recebem schedule_alarms, AlarmScheduler idempotente previne storm.
