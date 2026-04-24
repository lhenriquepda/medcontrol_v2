import { useState } from 'react'
import BottomSheet from './BottomSheet'
import { usePatientShares, useSharePatient, useUnsharePatient } from '../hooks/useShares'
import { useMyTier } from '../hooks/useSubscription'
import PaywallModal from './PaywallModal'

export default function SharePatientSheet({ open, onClose, patient }) {
  const { data: tier } = useMyTier()
  const isPro = tier === 'pro' || tier === 'admin'
  const patientId = patient?.id
  const { data: shares = [], isLoading } = usePatientShares(patientId)
  const shareMut = useSharePatient()
  const unshareMut = useUnsharePatient()
  const [email, setEmail] = useState('')
  const [err, setErr] = useState(null)
  const [okMsg, setOkMsg] = useState(null)
  const [paywall, setPaywall] = useState(false)

  async function submit(e) {
    e?.preventDefault?.()
    setErr(null); setOkMsg(null)
    const v = email.trim()
    if (!v) { setErr('Informe um e-mail.'); return }
    if (!isPro) { setPaywall(true); return }
    try {
      await shareMut.mutateAsync({ patientId, email: v })
      setOkMsg(`Paciente compartilhado com ${v}.`)
      setEmail('')
    } catch (e2) {
      setErr(e2?.message || 'Erro ao compartilhar.')
    }
  }

  async function remove(targetUserId) {
    try {
      await unshareMut.mutateAsync({ patientId, targetUserId })
    } catch (e) {
      setErr(e?.message || 'Erro ao remover.')
    }
  }

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title={`Compartilhar · ${patient?.name || ''}`}
        footer={
          <button onClick={onClose} className="btn-secondary w-full">Fechar</button>
        }>
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Compartilhe este paciente com outro usuário do MedControl.
            As alterações aparecem em tempo real para ambos.
            {' '}Recurso <span className="font-semibold text-brand-600">PRO</span> — apenas quem compartilha precisa ser PRO.
          </p>

          <form onSubmit={submit} className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              E-mail do convidado
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pessoa@exemplo.com"
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                autoCapitalize="none" autoCorrect="off"
              />
              <button
                type="submit"
                disabled={shareMut.isPending}
                className="btn-primary px-4 text-sm"
              >
                {shareMut.isPending ? '...' : 'Compartilhar'}
              </button>
            </div>
            {err && <p className="text-xs text-rose-600">{err}</p>}
            {okMsg && <p className="text-xs text-emerald-600">{okMsg}</p>}
            {!isPro && (
              <p className="text-[11px] text-amber-600">
                🔒 Você está no plano Free. Assine PRO para compartilhar.
              </p>
            )}
          </form>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Compartilhado com
            </p>
            {isLoading ? (
              <p className="text-xs text-slate-400">Carregando…</p>
            ) : shares.length === 0 ? (
              <p className="text-xs text-slate-400">Ninguém ainda.</p>
            ) : (
              <ul className="space-y-2">
                {shares.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                    <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center text-sm font-bold">
                      {(s.name || s.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.name || s.email}</p>
                      <p className="text-[11px] text-slate-500 truncate">{s.email}</p>
                    </div>
                    <button
                      onClick={() => remove(s.sharedWithUserId)}
                      disabled={unshareMut.isPending}
                      className="text-xs text-rose-600 hover:underline"
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </BottomSheet>
      <PaywallModal open={paywall} onClose={() => setPaywall(false)}
        reason="Compartilhar pacientes é um recurso PRO." />
    </>
  )
}
