import { useEffect, useMemo, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, X as XIcon, ChevronRight, Mail } from 'lucide-react'
import { TIMING, EASE } from '../animations'
import Icon from '../components/Icon'
import AdBanner from '../components/AdBanner'
import { Card, Button, Chip } from '../components/dosy'
import PageHeader from '../components/dosy/PageHeader'
import { FAQ as FAQ_DATA, FAQ_CATEGORIES, searchFaq } from '../data/faq'
import { track, EVENTS } from '../services/analytics'

const SUPPORT_EMAIL = 'suporte@dosymed.app'
/* eslint-disable no-undef */
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'
/* eslint-enable no-undef */

export default function FAQ() {
  const [query, setQuery] = useState('')
  const [openIds, setOpenIds] = useState(new Set())
  const [activeCategory, setActiveCategory] = useState('all')

  useEffect(() => { track(EVENTS.FAQ_OPENED) }, [])

  useEffect(() => {
    if (!query.trim()) return
    const t = setTimeout(() => {
      track(EVENTS.FAQ_SEARCH_QUERY, { query_length: query.trim().length })
    }, 800)
    return () => clearTimeout(t)
  }, [query])

  const results = useMemo(() => {
    let r = searchFaq(query)
    if (activeCategory !== 'all') r = r.filter((it) => it.category === activeCategory)
    return r
  }, [query, activeCategory])

  const grouped = useMemo(() => {
    const map = new Map()
    for (const cat of FAQ_CATEGORIES) map.set(cat.id, [])
    for (const it of results) {
      if (!map.has(it.category)) map.set(it.category, [])
      map.get(it.category).push(it)
    }
    return map
  }, [results])

  function toggle(id) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        track(EVENTS.FAQ_QUESTION_EXPANDED, { question_id: id })
      }
      return next
    })
  }

  function buildSupportMailto() {
    const subject = encodeURIComponent(`[Dosy] Suporte — ${APP_VERSION}`)
    const platform = Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'web'
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    const body = encodeURIComponent(
      `Olá, preciso de ajuda com:\n\n[descreva sua dúvida ou problema aqui]\n\n` +
        `---\n` +
        `Não apague — info técnica:\n` +
        `Versão: ${APP_VERSION}\n` +
        `Plataforma: ${platform}\n` +
        `User-Agent: ${ua}\n`,
    )
    return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`
  }

  function onSupportClick() {
    track(EVENTS.FAQ_SUPPORT_EMAIL_CLICKED, { from_search: query.trim().length > 0 })
  }

  const hasResults = results.length > 0
  const totalQuestions = FAQ_DATA.length

  return (
    <div style={{ paddingBottom: 110 }}>
      <PageHeader
        title="Ajuda / FAQ"
        subtitle={`${totalQuestions} perguntas frequentes`}
        back
      />

      <div className="max-w-md mx-auto px-4 pt-1" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AdBanner />

        {/* Search box */}
        <Card padding={12}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={18} strokeWidth={2} style={{ color: 'var(--dosy-fg-tertiary)', flexShrink: 0 }}/>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar pergunta ou palavra-chave…"
              aria-label="Buscar no FAQ"
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: 14, color: 'var(--dosy-fg)',
                fontFamily: 'var(--dosy-font-body)',
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Limpar busca"
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--dosy-fg-tertiary)',
                  display: 'inline-flex', padding: 2,
                }}
              ><XIcon size={16} strokeWidth={2}/></button>
            )}
          </label>
        </Card>

        {/* Category chips */}
        <div className="dosy-scroll" style={{
          display: 'flex', gap: 6, overflowX: 'auto', padding: '2px',
        }}>
          <Chip size="sm" active={activeCategory === 'all'} onClick={() => setActiveCategory('all')}>
            Todas
          </Chip>
          {FAQ_CATEGORIES.map((c) => (
            <Chip
              key={c.id}
              size="sm"
              active={activeCategory === c.id}
              onClick={() => setActiveCategory(c.id)}
            >
              {c.label}
            </Chip>
          ))}
        </div>

        {/* Empty state */}
        {!hasResults && (
          <Card padding={24} style={{
            textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}>
            <div style={{ fontSize: 36 }}>🤔</div>
            <p style={{
              fontSize: 14, fontWeight: 700, color: 'var(--dosy-fg)', margin: 0,
              fontFamily: 'var(--dosy-font-display)',
            }}>Nenhuma resposta encontrada</p>
            <p style={{
              fontSize: 12, color: 'var(--dosy-fg-secondary)', margin: 0,
              lineHeight: 1.5,
            }}>
              Tente outras palavras-chave ou fale direto com o suporte.
            </p>
            <a
              href={buildSupportMailto()}
              onClick={onSupportClick}
              style={{ textDecoration: 'none', marginTop: 4 }}
            >
              <Button kind="primary" icon={Mail} size="md">Falar com suporte</Button>
            </a>
          </Card>
        )}

        {/* Lista agrupada */}
        {hasResults && FAQ_CATEGORIES.map((cat) => {
          const items = grouped.get(cat.id) || []
          if (items.length === 0) return null
          return (
            <section key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <h2 style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--dosy-fg-secondary)',
                margin: '6px 0 2px 4px',
                fontFamily: 'var(--dosy-font-display)',
              }}>
                <Icon name={cat.icon} size={14} />
                <span>{cat.label}</span>
                <span style={{
                  fontSize: 10, fontWeight: 500,
                  color: 'var(--dosy-fg-tertiary)',
                  letterSpacing: 0,
                  textTransform: 'none',
                }}>({items.length})</span>
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.map((q) => (
                  <FaqItem
                    key={q.id}
                    item={q}
                    open={openIds.has(q.id)}
                    onToggle={() => toggle(q.id)}
                  />
                ))}
              </div>
            </section>
          )
        })}

        {/* CTA suporte */}
        {hasResults && (
          <Card padding={16} style={{
            textAlign: 'center', marginTop: 8,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}>
            <p style={{
              fontSize: 14, fontWeight: 700, color: 'var(--dosy-fg)',
              margin: 0, fontFamily: 'var(--dosy-font-display)',
            }}>Não achou o que procurava?</p>
            <p style={{
              fontSize: 12, color: 'var(--dosy-fg-secondary)',
              margin: '0 0 8px 0',
            }}>Nossa equipe responde em até 24h dias úteis.</p>
            <a
              href={buildSupportMailto()}
              onClick={onSupportClick}
              style={{ textDecoration: 'none' }}
            >
              <Button kind="secondary" icon={Mail} size="md">Falar com suporte</Button>
            </a>
          </Card>
        )}

        <p style={{
          fontSize: 10, textAlign: 'center',
          color: 'var(--dosy-fg-tertiary)',
          paddingTop: 4, margin: 0,
        }}>
          Dosy v{APP_VERSION} · O Dosy não substitui orientação médica.
        </p>
      </div>
    </div>
  )
}

function FaqItem({ item, open, onToggle }) {
  return (
    <div style={{
      background: 'var(--dosy-bg-elevated)',
      border: '1px solid var(--dosy-border)',
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: 'var(--dosy-shadow-xs)',
    }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="dosy-press"
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: 14, textAlign: 'left',
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--dosy-font-body)',
          color: 'var(--dosy-fg)',
        }}
      >
        <span style={{
          flex: 1, fontSize: 13.5, fontWeight: 600, lineHeight: 1.4,
          color: 'var(--dosy-fg)',
        }}>{item.question}</span>
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0,
            transition: 'transform 200ms var(--dosy-ease-out)',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            color: 'var(--dosy-fg-tertiary)',
            display: 'inline-flex',
          }}
        >
          <ChevronRight size={18} strokeWidth={2}/>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: TIMING.base, ease: EASE.inOut }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 14px 14px 14px' }}>
              <p style={{
                fontSize: 13, color: 'var(--dosy-fg-secondary)',
                lineHeight: 1.6, whiteSpace: 'pre-line', margin: 0,
              }}>
                {item.answer}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
