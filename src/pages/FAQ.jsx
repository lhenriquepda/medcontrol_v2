import { useEffect, useMemo, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { AnimatePresence, motion } from 'framer-motion'
import Header from '../components/Header'
import { TIMING, EASE } from '../animations'
import Icon from '../components/Icon'
import AdBanner from '../components/AdBanner'
import { FAQ as FAQ_DATA, FAQ_CATEGORIES, searchFaq } from '../data/faq'
import { track, EVENTS } from '../services/analytics'

const SUPPORT_EMAIL = 'suporte@dosyapp.com'
/* eslint-disable no-undef */
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'
/* eslint-enable no-undef */

/**
 * FAQ — perguntas frequentes (FASE 18.5).
 * - Search box no topo (filtra por question + keywords + answer)
 * - Lista por categoria, accordion expandable
 * - Empty state com CTA "Falar com suporte" (mailto)
 * - Eventos PostHog: faq_opened, faq_search_query, faq_question_expanded, faq_support_email_clicked
 */
export default function FAQ() {
  const [query, setQuery] = useState('')
  const [openIds, setOpenIds] = useState(new Set())
  const [activeCategory, setActiveCategory] = useState('all')

  // PostHog: pageview manual (rotas SPA já capturam, mas garante intent explícita)
  useEffect(() => {
    track(EVENTS.FAQ_OPENED)
  }, [])

  // Debounce track de search query (não loga cada tecla)
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

  // Agrupa por categoria pra render
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
        `User-Agent: ${ua}\n`
    )
    return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`
  }

  function onSupportClick() {
    track(EVENTS.FAQ_SUPPORT_EMAIL_CLICKED, { from_search: query.trim().length > 0 })
  }

  const hasResults = results.length > 0
  const totalQuestions = FAQ_DATA.length

  return (
    <div className="pb-28">
      <Header back title="Ajuda / FAQ" subtitle={`${totalQuestions} perguntas frequentes`} />
      <div className="max-w-md mx-auto px-4 pt-3 space-y-4">
        <AdBanner />

        {/* Search box */}
        <div className="card p-3">
          <label className="flex items-center gap-2">
            <Icon name="search" size={18} className="text-slate-400 shrink-0" />
            <input
              type="search"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-slate-400"
              placeholder="Buscar pergunta ou palavra-chave..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar no FAQ"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Limpar busca"
                className="text-slate-400 hover:text-slate-600"
              >
                <Icon name="close" size={16} />
              </button>
            )}
          </label>
        </div>

        {/* Category chips */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
          <Chip
            active={activeCategory === 'all'}
            onClick={() => setActiveCategory('all')}
            label="Todas"
          />
          {FAQ_CATEGORIES.map((c) => (
            <Chip
              key={c.id}
              active={activeCategory === c.id}
              onClick={() => setActiveCategory(c.id)}
              label={c.label}
            />
          ))}
        </div>

        {/* Empty state */}
        {!hasResults && (
          <div className="card p-6 text-center space-y-3">
            <div className="text-4xl">🤔</div>
            <p className="font-semibold">Nenhuma resposta encontrada</p>
            <p className="text-xs text-slate-500">
              Tente outras palavras-chave ou fale direto com o suporte abaixo.
            </p>
            <a
              href={buildSupportMailto()}
              onClick={onSupportClick}
              className="btn-primary inline-flex items-center gap-1.5 mt-2"
            >
              <Icon name="mail" size={16} /> Falar com suporte
            </a>
          </div>
        )}

        {/* Lista agrupada */}
        {hasResults &&
          FAQ_CATEGORIES.map((cat) => {
            const items = grouped.get(cat.id) || []
            if (items.length === 0) return null
            return (
              <section key={cat.id} className="space-y-2">
                <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mt-2">
                  <Icon name={cat.icon} size={14} />
                  <span>{cat.label}</span>
                  <span className="text-[10px] font-normal text-slate-400">({items.length})</span>
                </h2>
                <div className="space-y-1">
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

        {/* CTA suporte ao final (sempre visível) */}
        {hasResults && (
          <div className="card p-4 text-center mt-4">
            <p className="text-sm font-semibold mb-1">Não achou o que procurava?</p>
            <p className="text-xs text-slate-500 mb-3">
              Nossa equipe responde em até 24h dias úteis.
            </p>
            <a
              href={buildSupportMailto()}
              onClick={onSupportClick}
              className="btn-secondary inline-flex items-center gap-1.5"
            >
              <Icon name="mail" size={16} /> Falar com suporte
            </a>
          </div>
        )}

        <p className="text-[10px] text-center text-slate-400 pt-2">
          Dosy v{APP_VERSION} · O Dosy não substitui orientação médica.
        </p>
      </div>
    </div>
  )
}

function Chip({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition ${
        active
          ? 'bg-brand-600 text-white'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
      }`}
    >
      {label}
    </button>
  )
}

function FaqItem({ item, open, onToggle }) {
  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-3 p-4 text-left active:scale-[0.99]"
      >
        <span className="flex-1 font-medium text-sm leading-snug">{item.question}</span>
        <span
          className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
          aria-hidden="true"
        >
          <Icon name="chevron" size={18} className="text-slate-400" />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: TIMING.base, ease: EASE.inOut }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0">
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {item.answer}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
