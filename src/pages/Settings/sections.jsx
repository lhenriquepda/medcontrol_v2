// #029 (release v0.2.0.11) — Sections extraídas do Settings.jsx (692 LOC).
// Cada section é componente puro recebendo state + callbacks via props.
// Settings/index.jsx mantém orchestração + state. Reduz file size + modular.

import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Bell, BellOff, Sun, Moon, AlarmClock, Trash2, Download, ChevronRight, HelpCircle, ArrowUpCircle, Lock } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { Card, Button, Input, Toggle } from '../../components/dosy'
import Dropdown from '../../components/Dropdown'
import { track, EVENTS } from '../../services/analytics'
import { TIER_LABELS } from '../../utils/tierUtils'
import Row from './Row'
import { ADVANCE_OPTIONS, SECTION_LABEL_STYLE, sectionVariant } from './constants'

// ─── Plan card ───
export function PlanSection({ tier }) {
  return (
    <motion.div variants={sectionVariant}>
      <Card padding={16} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--dosy-gradient-sunset-soft)',
      }}>
        <div>
          <p style={{
            fontSize: 11, fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'var(--dosy-fg-secondary)', margin: 0,
            fontFamily: 'var(--dosy-font-display)',
          }}>Seu plano</p>
          <p style={{
            fontSize: 12, color: 'var(--dosy-fg-secondary)',
            margin: '2px 0 0 0',
          }}>Tier ativo da conta</p>
        </div>
        <span style={{
          fontSize: 12, fontWeight: 800, letterSpacing: '0.05em',
          padding: '6px 14px',
          background: tier === 'pro' || tier === 'admin'
            ? 'var(--dosy-gradient-sunset)'
            : 'var(--dosy-bg-elevated)',
          color: tier === 'pro' || tier === 'admin'
            ? 'var(--dosy-fg-on-sunset)'
            : 'var(--dosy-fg)',
          borderRadius: 9999,
          boxShadow: 'var(--dosy-shadow-sm)',
          textTransform: 'uppercase',
          fontFamily: 'var(--dosy-font-display)',
        }}>{TIER_LABELS[tier]}</span>
      </Card>
    </motion.div>
  )
}

// ─── Aparência (theme + icon style) ───
export function AppearanceSection({ theme, setTheme }) {
  return (
    <motion.section variants={sectionVariant}>
      <Card padding={16}>
        <p style={SECTION_LABEL_STYLE}>Aparência</p>
        <Row
          icon={theme === 'dark' ? Moon : Sun}
          label="Modo escuro"
          right={<Toggle value={theme === 'dark'} onChange={(v) => setTheme(v ? 'dark' : 'light')}/>}
        />
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--dosy-fg)', margin: 0 }}>Estilo de ícones</p>
            <p style={{ fontSize: 11.5, color: 'var(--dosy-fg-secondary)', margin: '2px 0 0 0', lineHeight: 1.4 }}>
              Flat = visual moderno · Emoji = legado colorido
            </p>
          </div>
          <select
            defaultValue={typeof window !== 'undefined' ? (localStorage.getItem('dosy_icon_style') || 'flat') : 'flat'}
            onChange={(e) => {
              if (e.target.value === 'flat') localStorage.removeItem('dosy_icon_style')
              else localStorage.setItem('dosy_icon_style', e.target.value)
              window.location.reload()
            }}
            style={{
              fontSize: 13, fontWeight: 600,
              padding: '8px 12px', borderRadius: 12,
              background: 'var(--dosy-bg-sunken)',
              color: 'var(--dosy-fg)',
              border: 'none', outline: 'none',
              fontFamily: 'var(--dosy-font-body)',
              cursor: 'pointer',
            }}
          >
            <option value="flat">Flat</option>
            <option value="emoji">Emoji</option>
          </select>
        </div>
      </Card>
    </motion.section>
  )
}

// ─── Notificações (push + advance + critical alarm + DND) ───
export function NotificationsSection({
  pushActive, pushLabel, pushSubtitle,
  loading, supported, permState,
  togglePush, handleAdvanceChange,
  notif, updateNotif,
}) {
  return (
    <motion.section variants={sectionVariant}>
      <Card padding={16}>
        <p style={SECTION_LABEL_STYLE}>Notificações</p>

        {/* Push toggle */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: 14, fontWeight: 600,
              color: 'var(--dosy-fg)', margin: 0,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <Bell size={14} strokeWidth={1.75}/>
              Notificações push
            </p>
            <p style={{
              fontSize: 11.5, color: 'var(--dosy-fg-secondary)',
              margin: '2px 0 0 0', lineHeight: 1.4,
            }}>{pushSubtitle}</p>
            {pushActive && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11, color: '#3F9E7E', fontWeight: 600,
                marginTop: 4,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: 9999,
                  background: '#3F9E7E', display: 'inline-block',
                  animation: 'dosy-pulse-ring 1.4s ease-out infinite',
                }}/>
                {pushLabel}
              </span>
            )}
            {!pushActive && supported && permState !== 'denied' && (
              <span style={{ fontSize: 11, color: 'var(--dosy-fg-tertiary)' }}>{pushLabel}</span>
            )}
            {permState === 'denied' && (
              <span style={{ fontSize: 11, color: 'var(--dosy-danger)' }}>{pushLabel}</span>
            )}
          </div>
          <Toggle
            value={pushActive}
            onChange={togglePush}
            disabled={loading || !supported || permState === 'denied'}
            ariaLabel="Notificações push"
          />
        </div>

        {/* Permissões verificar */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('dosy:checkPermissions'))}
          className="dosy-press"
          style={{
            width: '100%', textAlign: 'left',
            marginTop: 12,
            padding: '10px 14px',
            background: 'var(--dosy-bg-sunken)',
            border: 'none', borderRadius: 12,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            fontFamily: 'var(--dosy-font-body)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--dosy-fg)', margin: 0 }}>
              Verificar permissões do alarme
            </p>
            <p style={{ fontSize: 11, color: 'var(--dosy-fg-secondary)', margin: '2px 0 0 0', lineHeight: 1.4 }}>
              Alarme estilo despertador exige 4 permissões especiais Android.
            </p>
          </div>
          <ChevronRight size={16} strokeWidth={1.75} style={{ color: 'var(--dosy-primary)' }}/>
        </button>

        {/* Advance time — só com push ativo */}
        {pushActive && (
          <div style={{ marginTop: 14 }}>
            <Dropdown
              label="Avisar com antecedência"
              value={notif.advanceMins ?? 0}
              onChange={(v) => handleAdvanceChange(Number(v))}
              options={ADVANCE_OPTIONS}
              size="sm"
            />
          </div>
        )}

        {/* Alarme crítico */}
        {pushActive && (
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: 14, fontWeight: 600,
                color: 'var(--dosy-fg)', margin: 0,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <AlarmClock size={14} strokeWidth={1.75}/>
                Alarme crítico
              </p>
              <p style={{ fontSize: 11.5, color: 'var(--dosy-fg-secondary)', margin: '2px 0 0 0', lineHeight: 1.4 }}>
                Toca som contínuo, tela cheia, ignora silencioso e modo Não Perturbe.
                Recomendado para doses essenciais.
              </p>
            </div>
            <Toggle
              value={notif.criticalAlarm !== false}
              onChange={(v) => {
                updateNotif({ criticalAlarm: v })
                track(EVENTS.CRITICAL_ALARM_TOGGLED, { enabled: v })
              }}
              ariaLabel="Alarme crítico"
            />
          </div>
        )}

        {/* Não perturbe — cascata: aparece só se Alarme Crítico ON */}
        {pushActive && notif.criticalAlarm !== false && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 14, fontWeight: 600,
                  color: 'var(--dosy-fg)', margin: 0,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  <BellOff size={14} strokeWidth={1.75}/>
                  Não perturbe
                </p>
                <p style={{ fontSize: 11.5, color: 'var(--dosy-fg-secondary)', margin: '2px 0 0 0', lineHeight: 1.4 }}>
                  Define janela em que o alarme crítico não toca. Doses no horário recebem só
                  notificação push (sem despertador). Útil pra noite/madrugada.
                </p>
              </div>
              <Toggle
                value={notif.dndEnabled}
                onChange={(v) => {
                  updateNotif({ dndEnabled: v })
                  track(EVENTS.DND_TOGGLED, { enabled: v })
                }}
                ariaLabel="Não perturbe"
              />
            </div>
            {notif.dndEnabled && (
              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Input
                  label="De"
                  type="time"
                  value={notif.dndStart || '23:00'}
                  onChange={(e) => updateNotif({ dndStart: e.target.value })}
                />
                <Input
                  label="Até"
                  type="time"
                  value={notif.dndEnd || '07:00'}
                  onChange={(e) => updateNotif({ dndEnd: e.target.value })}
                />
              </div>
            )}
          </div>
        )}
      </Card>
    </motion.section>
  )
}

// ─── Privacidade e segurança (App Lock biometria #017) ───
export function SecuritySection({ appLock, toast }) {
  return (
    <motion.section variants={sectionVariant}>
      <Card padding={16}>
        <p style={SECTION_LABEL_STYLE}>Privacidade e segurança</p>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: 14, fontWeight: 600,
              color: 'var(--dosy-fg)', margin: 0,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <Lock size={14} strokeWidth={1.75}/>
              Bloqueio do app
            </p>
            <p style={{ fontSize: 11.5, color: 'var(--dosy-fg-secondary)', margin: '2px 0 0 0', lineHeight: 1.4 }}>
              {appLock.biometricAvailable
                ? 'Exige biometria (digital/face) ou senha do celular para abrir Dosy.'
                : 'Sem biometria configurada. Vai usar a senha do celular.'}
            </p>
          </div>
          <Toggle
            value={appLock.isEnabled}
            onChange={async (v) => {
              if (v) {
                const ok = await appLock.enable()
                if (ok) toast.show({ message: 'Bloqueio ativado.', kind: 'success' })
                else toast.show({ message: 'Não foi possível ativar o bloqueio.', kind: 'error' })
              } else {
                const ok = await appLock.disable()
                if (ok) toast.show({ message: 'Bloqueio desativado.', kind: 'info' })
              }
            }}
            ariaLabel="Bloqueio do app"
          />
        </div>

        {appLock.isEnabled && (
          <div style={{ marginTop: 14 }}>
            <Dropdown
              label="Bloquear após inatividade"
              value={appLock.timeoutMin}
              onChange={(v) => appLock.setTimeoutMin(Number(v))}
              options={[
                { value: 1, label: '1 minuto' },
                { value: 5, label: '5 minutos' },
                { value: 15, label: '15 minutos' },
                { value: 30, label: '30 minutos' },
                { value: 60, label: '1 hora' },
              ]}
              size="sm"
            />
          </div>
        )}
      </Card>
    </motion.section>
  )
}

// ─── Conta (nome + logout) ───
export function AccountSection({ name, setName, savingName, saveName, user, onLogoutClick }) {
  return (
    <motion.section variants={sectionVariant}>
      <Card padding={16}>
        <p style={SECTION_LABEL_STYLE}>Conta</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Input
            label="Seu nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Como quer ser chamado"
          />
          <Button
            kind="primary"
            full
            onClick={saveName}
            disabled={savingName || !name.trim()}
          >
            {savingName ? 'Salvando…' : 'Salvar nome'}
          </Button>
          <p style={{ fontSize: 12, color: 'var(--dosy-fg-secondary)', margin: '4px 0 0 4px' }}>
            {user?.email || 'Demo'}
          </p>
          <Button kind="secondary" full onClick={onLogoutClick}>
            Sair
          </Button>
        </div>
      </Card>
    </motion.section>
  )
}

// ─── Dados & Privacidade (LGPD export + delete) ───
export function DataPrivacySection({ exportingData, exportUserData, onDeleteClick }) {
  return (
    <motion.section variants={sectionVariant}>
      <Card padding={16}>
        <p style={SECTION_LABEL_STYLE}>Dados & Privacidade</p>
        <p style={{ fontSize: 12, color: 'var(--dosy-fg-secondary)', lineHeight: 1.5, margin: '0 0 12px 0' }}>
          Conforme a LGPD, você pode exportar ou excluir todos os seus dados a qualquer momento.
        </p>
        <Button
          kind="secondary"
          full
          icon={Download}
          onClick={exportUserData}
          disabled={exportingData}
        >
          {exportingData
            ? 'Gerando backup…'
            : (Capacitor.isNativePlatform() ? 'Compartilhar meus dados (JSON)' : 'Exportar meus dados (JSON)')}
        </Button>
        <div style={{ marginTop: 8 }}>
          <Button
            kind="danger"
            full
            icon={Trash2}
            onClick={onDeleteClick}
          >
            Excluir minha conta e todos os dados
          </Button>
        </div>
      </Card>
    </motion.section>
  )
}

// ─── Versão / Update / FAQ ───
export function VersionSection({ update }) {
  return (
    <motion.section variants={sectionVariant}>
      <Card padding={16}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: 13, fontWeight: 700, color: 'var(--dosy-fg)', margin: 0,
              fontFamily: 'var(--dosy-font-display)',
            }}>Versão</p>
            <p style={{ fontSize: 12, color: 'var(--dosy-fg-secondary)', margin: '2px 0 0 0' }}>
              Dosy v{update.current} · pt-BR
            </p>
          </div>
          {update.available ? (
            <Button
              kind="primary"
              size="sm"
              icon={ArrowUpCircle}
              onClick={async () => {
                if (Capacitor.isNativePlatform()) {
                  try {
                    const { Browser } = await import('@capacitor/browser')
                    await Browser.open({ url: 'https://dosy-app.vercel.app' + (update.latest?.installUrl || '/install') })
                  } catch {
                    window.open('https://dosy-app.vercel.app' + (update.latest?.installUrl || '/install'), '_blank')
                  }
                } else {
                  window.location.reload()
                }
              }}
            >
              Atualizar v{update.latest?.version}
            </Button>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--dosy-fg-tertiary)' }}>Atualizado</span>
          )}
        </div>
        {update.available && (
          <p style={{ fontSize: 11, color: '#3F9E7E', margin: '8px 0 0 0' }}>
            Nova versão disponível com correções e melhorias.
          </p>
        )}
        <Link
          to="/faq"
          className="dosy-press"
          style={{
            marginTop: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px',
            background: 'var(--dosy-bg-sunken)',
            borderRadius: 12,
            textDecoration: 'none',
            color: 'var(--dosy-fg)',
            fontFamily: 'var(--dosy-font-body)',
          }}
        >
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 13, fontWeight: 600,
          }}>
            <HelpCircle size={14} strokeWidth={1.75}/> Dúvidas frequentes
          </span>
          <ChevronRight size={14} strokeWidth={1.75} style={{ color: 'var(--dosy-fg-tertiary)' }}/>
        </Link>
      </Card>
    </motion.section>
  )
}
