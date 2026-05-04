/**
 * Dosy BottomNav — release v0.2.0.0 redesign.
 * Source design: contexto/claude-design/dosy/project/src/Primitives.jsx (BottomNav).
 *
 * Pill flutuante com glass blur bg, center plus (FAB) com sunset gradient
 * elevado. 5 itens (Início, Pacientes, +Novo FAB, S.O.S, Mais).
 *
 * MANTÉM lógica/comportamento legacy:
 * - usePatients pra detectar se zero pacientes (FAB → /pacientes/novo)
 *   senão → /tratamento/novo
 * - NavLink com end={true} em '/' pra exact match
 * - aria-label em todos itens
 * - safe-area-inset-bottom respect
 */
import { NavLink, useNavigate } from 'react-router-dom'
import { Home, Users, Plus, Siren, MoreHorizontal } from 'lucide-react'
import { usePatients } from '../../hooks/usePatients'

const TABS = [
  { id: 'inicio',    to: '/',          end: true,  icon: Home,             label: 'Início' },
  { id: 'pacientes', to: '/pacientes', end: false, icon: Users,            label: 'Pacientes' },
  { id: 'fab',       fab: true,        icon: Plus,                          label: 'Novo' },
  { id: 'sos',       to: '/sos',       end: false, icon: Siren,             label: 'S.O.S' },
  { id: 'mais',      to: '/mais',      end: false, icon: MoreHorizontal,    label: 'Mais' },
]

export default function DosyBottomNav() {
  const nav = useNavigate()
  const { data: patients = [] } = usePatients()
  const fabTarget = patients.length === 0 ? '/pacientes/novo' : '/tratamento/novo'

  return (
    <nav
      aria-label="Navegação principal"
      style={{
        position: 'fixed',
        left: 12, right: 12,
        // #112 [Note 10 fix]: env(safe-area-inset-bottom) reportava 50px+ em
        // devices Samsung com 3-button nav clássico, empurrando BottomNav
        // muito acima do bottom edge. Cap em 16px via min() — suficiente pra
        // gesture nav modern (S25) sem inflar em Note 10 / 3-button.
        bottom: 'calc(8px + min(env(safe-area-inset-bottom, 0px), 16px))',
        zIndex: 30,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          maxWidth: 448,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          background: 'color-mix(in oklab, var(--dosy-bg-elevated) 92%, transparent)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderRadius: 9999,
          boxShadow: '0 16px 32px -10px rgba(74,36,16,0.22), 0 4px 10px -2px rgba(74,36,16,0.08)',
          pointerEvents: 'auto',
          border: '1px solid var(--dosy-border)',
          fontFamily: 'var(--dosy-font-display)',
        }}
      >
        {TABS.map((tab) => {
          const IconCmp = tab.icon
          if (tab.fab) {
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => nav(fabTarget)}
                aria-label="Novo (paciente ou tratamento)"
                className="dosy-press"
                style={{
                  width: 50, height: 50, borderRadius: 9999, border: 'none',
                  background: 'var(--dosy-gradient-sunset)',
                  color: 'var(--dosy-fg-on-sunset)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                  boxShadow: '0 10px 20px -6px rgba(255,61,127,0.5)',
                }}
              >
                <IconCmp size={24} strokeWidth={2}/>
              </button>
            )
          }
          return (
            <NavLink
              key={tab.id}
              to={tab.to}
              end={tab.end}
              aria-label={tab.label}
              style={({ isActive }) => ({
                border: 'none',
                cursor: 'pointer',
                padding: '6px 10px',
                minWidth: 56,
                borderRadius: 9999,
                background: 'transparent',
                color: isActive ? 'var(--dosy-primary)' : 'var(--dosy-fg-tertiary)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                fontWeight: 600, fontSize: 10.5, letterSpacing: '0.01em',
                transition: 'color 200ms var(--dosy-ease-out)',
                textDecoration: 'none',
              })}
            >
              {({ isActive }) => (
                <>
                  <IconCmp size={20} strokeWidth={isActive ? 2 : 1.75}/>
                  <span>{tab.label}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
