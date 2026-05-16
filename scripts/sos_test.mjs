// Test SOS submit confirm dialog fix
// Procedure: register 1ª Dipirona Rael, then 2ª immediate → triggers over-limit
// → ConfirmDialog should appear (not silent fail like window.confirm)
import { WebSocket } from 'ws'

const PAGE = process.argv[2]
if (!PAGE) { console.error('usage: sos_test.mjs PAGE_ID'); process.exit(1) }

const ws = new WebSocket(`ws://localhost:9222/devtools/page/${PAGE}`)
let id = 0
function send(method, params = {}) {
  return new Promise(r => {
    const myId = ++id
    ws.send(JSON.stringify({ id: myId, method, params }))
    const h = d => { const m = JSON.parse(d); if (m.id === myId) { ws.off('message', h); r(m.result) } }
    ws.on('message', h)
  })
}

await new Promise(r => ws.once('open', r))
console.log('CDP connected')
await send('Runtime.enable')

// 1. Nav to SOS
await send('Runtime.evaluate', {
  expression: `(() => { window.history.pushState({},'','/sos'); window.dispatchEvent(new PopStateEvent('popstate')); 'nav'; })()`,
  returnByValue: true,
})
await new Promise(r => setTimeout(r, 1500))

// 2. Find Rael patient ID + select + fill form
async function fillForm() {
  const r = await send('Runtime.evaluate', {
    expression: `
      (() => {
        // Get patient cards
        const chips = Array.from(document.querySelectorAll('button, [role=button]'));
        const rael = chips.find(b => b.textContent?.trim() === 'Rael' || /Rael$/.test(b.textContent?.trim() || ''));
        if (!rael) {
          return 'no Rael chip; found: ' + chips.map(b => b.textContent?.trim()).filter(Boolean).slice(0,10).join('|');
        }
        rael.click();
        // Wait, then fill medication input via React setter
        const setVal = (el, v) => {
          const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
          d.set.call(el, v);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
        setTimeout(() => {
          const med = document.querySelector('input[placeholder*="Paracetamol" i]') || document.querySelectorAll('input[type=text]')[0];
          const dose = Array.from(document.querySelectorAll('input')).find(i => i.placeholder?.toLowerCase().includes('1 cp') || i.placeholder?.toLowerCase().includes('1 comprimido') || i.placeholder?.toLowerCase().includes('15 gotas'));
          if (med) setVal(med, 'Dipirona');
          if (dose) setVal(dose, '1 cp');
          window.__sosFilled = { med: !!med, dose: !!dose };
        }, 300);
        return 'Rael clicked, fill scheduled';
      })()
    `,
    returnByValue: true,
  })
  console.log('fill:', r.result?.value)
}

await fillForm()
await new Promise(r => setTimeout(r, 1500))

// 3. Verify filled
const filled = await send('Runtime.evaluate', {
  expression: `JSON.stringify(window.__sosFilled || {})`,
  returnByValue: true,
})
console.log('filled state:', filled.result?.value)

// 4. Submit (1st dose - should pass)
const sub1 = await send('Runtime.evaluate', {
  expression: `
    (() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim().includes('Registrar S.O.S'));
      if (!btn) return 'no submit btn';
      btn.click();
      return 'submit 1 clicked';
    })()
  `,
  returnByValue: true,
})
console.log('submit1:', sub1.result?.value)

ws.close()
process.exit(0)
