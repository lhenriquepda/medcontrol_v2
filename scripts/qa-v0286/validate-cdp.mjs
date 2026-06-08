/**
 * validate-cdp.mjs — Validação E2E NATIVA do fix do bug crônico de conexão DB
 * (v0.2.8.6 dual-client lock-free). Ver docs/diagnostico_conexao_cronica.md.
 *
 * Abordagem CDP (robusta com os WebViews extras do AdMob) + assertions DOM/network
 * (NÃO usa Capacitor.Plugins: em Capacitor v8 SecureStorage/Preferences vivem só no
 * escopo do módulo npm, não em window). Sinal-chave: o interceptor de fetch captura
 * (a) Bearer JWT vs anon em TODA request /rest/v1 e (b) o status do RPC
 * confirm/skip/undo_dose_v3 — 200 = gravou DIRETO; ausência/erro = foi pra FILA (o bug).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * RECOMENDADO RODAR NO DEVICE REAL (S25U) COM teste-plus JÁ LOGADO:
 *   DOSY_DEVICE=<serial> node scripts/qa-v0286/validate-cdp.mjs
 * Aí o script pula o login (usa a sessão viva), acha as doses reais e valida o
 * mark-dose end-to-end (cenários B e C).
 *
 * ⚠️ CAVEAT EMULADOR: o WebView do emulador tem o credential-manager do Google que
 * SUBSTITUI as credenciais digitadas por uma conta salva (ex.: teste4, que não tem
 * doses) no submit do form — abaixo do nível que o CDP alcança. Por isso, no
 * emulador o login limpo (DOSY_WIPE=1) pode cair numa conta sem doses e os cenários
 * B/C ficam sem card pra marcar. Os cenários A (Bearer JWT) + E (logcat) validam
 * nativamente mesmo assim. No device real (sessão teste-plus viva) o problema não ocorre.
 *
 * Uso:
 *   DOSY_DEVICE=<serial> node scripts/qa-v0286/validate-cdp.mjs   # usa sessão viva (ideal)
 *   DOSY_WIPE=1 ... node scripts/qa-v0286/validate-cdp.mjs        # login limpo (emulador: ver caveat)
 *
 * Rule 15: ABORTA se a saudação não for de conta teste (precisa conter "Teste").
 */
import { WebSocket } from 'ws'
import { execSync } from 'node:child_process'

const DEVICE = process.argv[2] || process.env.DOSY_DEVICE || 'emulator-5554'
const PKG = process.env.DOSY_PKG || 'com.dosyapp.dosy.dev'
const ACTIVITY = process.env.DOSY_ACTIVITY || 'com.dosyapp.dosy.MainActivity'
const EMAIL = process.env.DOSY_EMAIL || 'teste-plus@teste.com'
const PASS = process.env.DOSY_PASS || '123456'
const WIPE = process.env.DOSY_WIPE === '1'
const PORT = 9377
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const sh = (c) => execSync(c, { encoding: 'utf8' })
const adb = (c) => sh(`adb -s ${DEVICE} ${c}`)

const results = []
const rec = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`) }

// ── conecta CDP à página da Dosy (localhost), ignorando AdMob ──
async function connect() {
  const pid = adb(`shell pidof ${PKG}`).trim()
  if (!pid) throw new Error('app não está rodando')
  try { adb(`forward tcp:${PORT} localabstract:webview_devtools_remote_${pid}`) } catch {}
  for (let i = 0; i < 20; i++) {
    let list = []
    try { list = JSON.parse(sh(`curl -s http://127.0.0.1:${PORT}/json/list`)) } catch {}
    const page = list.find((d) => d.type === 'page' && /https:\/\/localhost/i.test(d.url) && !/googleads|doubleclick/i.test(d.url))
    if (page) {
      const ws = new WebSocket(page.webSocketDebuggerUrl)
      await new Promise((r, j) => { ws.once('open', r); ws.once('error', j) })
      let id = 0
      const send = (m, p = {}) => new Promise((res) => { const myId = ++id; const h = (d) => { const x = JSON.parse(d); if (x.id === myId) { ws.off('message', h); res(x.result) } }; ws.on('message', h); ws.send(JSON.stringify({ id: myId, method: m, params: p })) })
      await send('Runtime.enable')
      const evalc = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r?.exceptionDetails) return { __err: r.exceptionDetails.exception?.description || r.exceptionDetails.text }; return r?.result?.value }
      return { ws, send, evalc, url: page.url }
    }
    await sleep(1000)
  }
  throw new Error('página Dosy (localhost) não apareceu no CDP')
}

const rootText = (cdp) => cdp.evalc('(document.getElementById("root")?.textContent||"").replace(/\\s+/g," ").trim()')

// instala interceptor de fetch: conta Bearer JWT/anon + status dos RPC confirm/skip/undo_dose
const INSTALL_CAP = `(() => {
  if (window.__cap) { window.__cap.jwt=0; window.__cap.anon=0; window.__cap.rpc=[]; return 'reset' }
  window.__cap = { jwt:0, anon:0, last:null, rpc:[] }
  const o = window.fetch
  window.fetch = function(i, init){
    let u=''; try{ u = typeof i==='string'?i:(i?.url||'') }catch{}
    try {
      if(/\\/rest\\/v1\\//.test(u)){
        const h=(init&&init.headers)||{}; let a = h instanceof Headers ? h.get('Authorization') : (h.Authorization||h.authorization||'')
        const t=(a||'').replace(/^Bearer\\s+/i,''); if(/^eyJ/.test(t)){window.__cap.jwt++;window.__cap.last='JWT'} else if(t){window.__cap.anon++;window.__cap.last='ANON'}
      }
    } catch {}
    const p = o.apply(this, arguments)
    if(/\\/rest\\/v1\\/rpc\\/(confirm|skip|undo)_dose/.test(u)){
      p.then(r=>{ try{ window.__cap.rpc.push({rpc:u.split('/rpc/')[1].split('?')[0], status:r.status, ok:r.ok}) }catch{} }).catch(e=>{ window.__cap.rpc.push({rpc:'err', status:0, msg:String(e).slice(0,60)}) })
    }
    return p
  }
  return 'installed'
})()`

async function login(cdp) {
  // espera tela de login
  for (let i = 0; i < 20; i++) {
    const has = await cdp.evalc('!!(document.querySelector("input[type=email]")&&document.querySelector("input[type=password]"))')
    if (has) break
    await sleep(1000)
  }
  const r = await cdp.evalc(`(() => {
    const setN=(el,v)=>{const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}
    const em=document.querySelector('input[type=email]'), pw=document.querySelector('input[type=password]')
    if(!em||!pw) return {ok:false,reason:'sem campos'}
    // quebra a associação de autofill do Chrome (que substitui por credencial salva)
    for (const el of [em, pw]) { el.setAttribute('autocomplete','off'); el.setAttribute('readonly',''); }
    setN(em,'${EMAIL}'); setN(pw,'${PASS}')
    for (const el of [em, pw]) el.removeAttribute('readonly')
    setN(em,'${EMAIL}'); setN(pw,'${PASS}')
    return {ok:true, emVal: em.value, pwLen: pw.value.length}
  })()`)
  if (!r?.ok) return r
  await sleep(300)
  // re-confirma o valor logo antes de submeter (autofill pode ter re-disparado)
  const sub = await cdp.evalc(`(() => {
    const setN=(el,v)=>{const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}))}
    const em=document.querySelector('input[type=email]'), pw=document.querySelector('input[type=password]')
    if(em.value!=='${EMAIL}') setN(em,'${EMAIL}')
    if(pw.value.length!==${PASS.length}) setN(pw,'${PASS}')
    const b=[...document.querySelectorAll('button[type=submit]')].find(x=>/entrar/i.test(x.textContent))||[...document.querySelectorAll('button')].find(x=>/^entrar$/i.test((x.textContent||'').trim()))
    if(!b) return {ok:false,reason:'sem botão Entrar'}
    b.click(); return {ok:true, emAtSubmit: em.value}
  })()`)
  return sub
}

async function dismiss(cdp) {
  for (let i = 0; i < 5; i++) {
    const did = await cdp.evalc(`(() => { const b=[...document.querySelectorAll('button,a,[role=button]')].find(x=>/^(pular|recusar|skip|agora não|depois)$/i.test((x.textContent||'').trim())); if(b){b.click();return true} return false })()`)
    if (!did) break
    await sleep(700)
  }
}

async function goHome(cdp) {
  await cdp.evalc(`(() => { const n=[...document.querySelectorAll('a,button,[role=button]')].find(b=>/^in[íi]cio$/i.test((b.textContent||'').trim())); if(n){n.click()} else if(location.pathname!=='/'){history.pushState({},'','/');dispatchEvent(new PopStateEvent('popstate'))} })()`)
  await sleep(1800)
}

const overdue = async (cdp) => Number(((await rootText(cdp)).match(/(\d+)\s*atrasada/) || [])[1] ?? -1)

async function markDose(cdp) {
  await dismiss(cdp)
  const open = await cdp.evalc(`(() => {
    const cs=[...document.querySelectorAll('div,li,article,button')].filter(el=>{const t=el.textContent||'';return /\\d{1,2}:\\d{2}/.test(t)&&t.length<240&&el.querySelectorAll('div,span,button').length<16}).sort((a,b)=>a.textContent.length-b.textContent.length)
    if(!cs.length) return {ok:false}
    cs[0].scrollIntoView({block:'center'}); cs[0].click(); return {ok:true,t:(cs[0].textContent||'').replace(/\\s+/g,' ').trim().slice(0,40)}
  })()`)
  if (!open?.ok) return { ok: false, reason: 'sem card de dose' }
  await sleep(1400)
  const tap = await cdp.evalc(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/tomada/i.test((x.textContent||'').trim())&&(x.textContent||'').trim().length<14); if(!b) return {ok:false,btns:[...document.querySelectorAll('button')].map(x=>(x.textContent||'').trim()).filter(Boolean).slice(0,10)}; b.scrollIntoView({block:'center'}); b.click(); return {ok:true} })()`)
  return { ...tap, card: open.t }
}

// ───────────────────────── main ─────────────────────────
let cdp
try {
  console.log(`\n=== Validação CDP conexão crônica v0.2.8.6 — ${DEVICE} ===\n`)
  if (WIPE) { console.log('pm clear (wipe data)...'); adb(`shell pm clear ${PKG}`); await sleep(1500) }
  adb(`shell am start -n ${PKG}/${ACTIVITY}`); await sleep(WIPE ? 7000 : 4000)

  cdp = await connect()
  console.log('CDP conectado:', cdp.url)

  // aguarda o React renderizar (root com conteúdo)
  for (let i = 0; i < 20; i++) {
    const len = await cdp.evalc('document.getElementById("root")?.innerHTML?.length||0')
    if (len > 500) break
    await sleep(1000)
  }

  // instala o interceptor CEDO (antes do login) pra capturar fetchDashboard
  await cdp.evalc(INSTALL_CAP)

  // login se houver campo de senha (tela de login)
  let onLogin = await cdp.evalc('!!document.querySelector("input[type=password]")')
  if (onLogin) {
    console.log('tela de login → logando', EMAIL)
    const lr = await login(cdp); if (!lr?.ok) throw new Error('login falhou: ' + JSON.stringify(lr))
    // espera sair da tela de login (dashboard) — até 25s
    for (let i = 0; i < 25; i++) {
      await dismiss(cdp)
      onLogin = await cdp.evalc('!!document.querySelector("input[type=password]")')
      const greeted = /Bo[am]\s+\w+,/.test(await rootText(cdp))
      if (!onLogin && greeted) break
      await sleep(1000)
    }
    await goHome(cdp)
  }
  let txt = await rootText(cdp)

  // Rule 15 — saudação deve ser de conta teste
  const greet = (txt.match(/Bo[am]\s+\w+,\s*([^0-9]{1,30})/) || [])[1]?.trim() || '(?)'
  const isTest = /teste|test/i.test(greet)
  rec('Rule 15 — conta teste (saudação)', isTest, `"${greet}"`)
  if (!isTest) throw new Error('Rule 15: conta não-teste detectada ("' + greet + '"). ABORTANDO.')

  await goHome(cdp)
  // aguarda a dashboard popular (fetchDashboard via supabaseData) — doses do servidor
  for (let i = 0; i < 15; i++) {
    const hasDoses = await cdp.evalc(`(() => { const t=document.getElementById('root')?.textContent||''; return /atrasada|pendente|\\d{1,2}:\\d{2}/.test(t) })()`)
    if (hasDoses) break
    await sleep(1000)
  }
  await sleep(500)

  // A. dashboard + Bearer (interceptor já estava ativo desde antes do login)
  const od0 = await overdue(cdp)
  rec('A. Dashboard nativo carrega', /atrasada|pendente|doses/i.test(txt) && !/Esqueci minha senha/.test(txt), `atrasadas=${od0}`)
  await cdp.evalc(`window.dispatchEvent(new Event('focus'))`); await sleep(3000)
  let cap = await cdp.evalc('JSON.stringify(window.__cap)'); cap = JSON.parse(cap)
  rec('A. Bearer JWT (nunca anon) em /rest/v1', cap.jwt > 0 && cap.anon === 0, `jwt=${cap.jwt} anon=${cap.anon}`)

  // B. marcar dose → confirm_dose_v3 200 (grava direto) + sem anon
  await cdp.evalc(INSTALL_CAP)
  const mk = await markDose(cdp); await sleep(5000)
  const od1 = await overdue(cdp)
  cap = JSON.parse(await cdp.evalc('JSON.stringify(window.__cap)'))
  const confirmOk = cap.rpc.some((x) => /confirm_dose/.test(x.rpc) && x.ok)
  rec('B. Marcar dose grava DIRETO (confirm_dose_v3 200, não fila)', mk.ok && confirmOk && cap.anon === 0,
    `markOk=${mk.ok} rpc=${JSON.stringify(cap.rpc)} atrasadas:${od0}→${od1}`)

  // C. background → foreground → marcar de novo
  adb('shell input keyevent KEYCODE_HOME'); await sleep(3000)
  adb(`shell am start -n ${PKG}/${ACTIVITY}`); await sleep(4000)
  try { cdp.ws.close() } catch {}
  cdp = await connect(); await goHome(cdp); await cdp.evalc(INSTALL_CAP)
  const txt2 = await rootText(cdp)
  const mk2 = await markDose(cdp); await sleep(5000)
  cap = JSON.parse(await cdp.evalc('JSON.stringify(window.__cap)'))
  const confirmOk2 = cap.rpc.some((x) => /confirm_dose/.test(x.rpc) && x.ok)
  rec('C. Pós background→foreground: grava direto + segue logado', mk2.ok && confirmOk2 && cap.anon === 0 && !/Esqueci minha senha/.test(txt2),
    `markOk=${mk2.ok} rpc=${JSON.stringify(cap.rpc)}`)

  // E. logcat
  let lc = ''; try { lc = adb('logcat -d -t 3000') } catch {}
  const begins = (lc.match(/#_acquireLock.*begin/g) || []).length
  const ends = (lc.match(/#_acquireLock.*end/g) || []).length
  const slow = (lc.match(/getValidSession lento/g) || []).length
  rec('E. logcat: locks balanceados + sem authedRpc lento', begins <= ends && slow === 0, `acquireLock ${begins}/${ends} | slow=${slow}`)
} catch (e) {
  rec('FATAL', false, e?.message || String(e))
} finally {
  try { cdp?.ws.close() } catch {}
  const ok = results.filter((r) => r.pass).length
  console.log(`\n=== RESULTADO: ${ok}/${results.length} ===`)
  results.forEach((r) => console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  (' + r.detail + ')' : ''}`))
  process.exit(results.length && results.every((r) => r.pass) ? 0 : 1)
}
