/**
 * /install — public landing page for Android APK beta distribution.
 *
 * Hosts a "Download APK" button + step-by-step install instructions for testers.
 * APK file is served directly from Vercel at /dosy-beta.apk (built into public/).
 */
/* eslint-disable no-undef */
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'
/* eslint-enable no-undef */
import Icon from '../components/Icon'
const APK_URL = '/dosy-beta.apk'
const APK_VERSION = `${APP_VERSION}-beta`

export default function Install() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isAndroid = /android/i.test(ua)

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0d1535] to-[#1a2660] text-white">
      <div className="max-w-md mx-auto px-6 py-10">
        <div className="text-center mb-8">
          <img src="/dosy-logo-light.png" alt="Dosy" className="h-20 mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-bold">Beta Android</h1>
          <p className="text-sm text-white/60 mt-1">Versão {APK_VERSION} · ~12 MB</p>
        </div>

        {!isAndroid && (
          <div className="bg-amber-500/20 border border-amber-400/40 rounded-xl p-4 mb-6 text-sm flex items-start gap-2">
            <Icon name="warning" size={16} className="shrink-0 mt-0.5" /> <span>Esta página é para <strong>celular Android</strong>. Abra <code>/install</code> no celular pra instalar o app.</span>
          </div>
        )}

        {/* Download button */}
        <a
          href={APK_URL}
          download="dosy.apk"
          className="block w-full text-center py-4 mb-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold shadow-lg active:scale-95 transition"
        >
          <span className="inline-flex items-center justify-center gap-2"><Icon name="download" size={18} /> Baixar APK ({APK_VERSION})</span>
        </a>

        <div className="bg-white/5 backdrop-blur rounded-2xl p-5 space-y-5">
          <h2 className="text-lg font-semibold">Como instalar</h2>

          <Step n={1} title="Permitir fontes desconhecidas">
            Quando o Chrome perguntar, toque em <strong>"Configurações"</strong> e ative
            <strong> "Permitir desta fonte"</strong>. Volta e instala.
          </Step>

          <Step n={2} title="Instalar o APK">
            Toca no arquivo baixado (na barra de notificações ou em Downloads).
            Confirma <strong>"Instalar"</strong>.
          </Step>

          <Step n={3} title="Abrir o Dosy">
            Toca <strong>"Abrir"</strong> ou encontra o ícone Dosy na home.
          </Step>

          <Step n={4} title="Liberar permissões do alarme">
            Na primeira vez, o app vai pedir <strong>4 permissões</strong>:
            <ul className="mt-2 ml-4 space-y-1 list-disc text-white/80">
              <li>Notificações</li>
              <li>Alarmes exatos</li>
              <li>Notificações em tela cheia</li>
              <li>Aparecer sobre outros apps</li>
            </ul>
            <p className="mt-2 text-xs text-white/60">
              Sem isso, o alarme não funciona como despertador. O app guia você por cada uma.
            </p>
          </Step>

          <Step n={5} title="Login">
            Use sua conta de email cadastrada. Se for primeira vez, crie a conta.
          </Step>
        </div>

        <div className="mt-6 bg-blue-500/10 border border-blue-400/30 rounded-xl p-4 text-xs text-white/70">
          <p className="font-medium text-white/90 mb-1">📲 Beta privado</p>
          <p>
            Este é um teste interno. Encontrou bug? Envia email pra
            {' '}<a href="mailto:dosy.med@gmail.com" className="underline text-blue-300">dosy.med@gmail.com</a>
            {' '}com print + descrição.
          </p>
        </div>

        <div className="mt-6 text-center text-xs text-white/40 space-y-1">
          <p>Pacote: <code className="text-white/60">com.dosyapp.dosy</code></p>
          <p>Min Android: 8.0 (API 26)</p>
          <a href="/privacidade" className="block text-white/60 underline">Política de Privacidade</a>
          <a href="/termos" className="block text-white/60 underline">Termos de Uso</a>
        </div>
      </div>
    </div>
  )
}

function Step({ n, title, children }) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center font-bold text-sm">
        {n}
      </div>
      <div className="flex-1 text-sm">
        <p className="font-semibold mb-1">{title}</p>
        <div className="text-white/70 leading-relaxed">{children}</div>
      </div>
    </div>
  )
}
