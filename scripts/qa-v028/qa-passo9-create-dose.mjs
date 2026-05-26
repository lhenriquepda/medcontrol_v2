// Passo 9: Cria DoseA_Test_Alarm no QA_Paciente em teste-plus, +15min
import { connect, screenshot, sleep } from './qa-cdp-helpers.mjs';

const { send, evalCDP } = await connect(9222);

// Já estamos em /pacientes/<id>. Procura "+ Novo tratamento"
const state = await evalCDP(`(() => ({
  pathname: location.pathname,
  hasNovoTratamento: !!Array.from(document.querySelectorAll('button, a')).find(el => /Novo.*tratamento/i.test(el.textContent||'')),
  btns: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t=>t.length>0).slice(0,15),
}))`);
console.log('state:', JSON.stringify(state, null, 2));

// Click "Novo tratamento"
const click1 = await evalCDP(`(() => {
  const btns = Array.from(document.querySelectorAll('button, a, [role="button"]'));
  const novo = btns.find(b => /Novo tratamento|Novo$/i.test((b.textContent||'').trim()));
  if (!novo) return { fail: 'no novo btn' };
  novo.click();
  return { clicked: novo.textContent.trim() };
})()`);
console.log('click Novo:', JSON.stringify(click1));
await sleep(2000);
console.log('shot:', await screenshot(send, 'emul_step9_form_tratamento'));

// Inspeciona form
const inspect = await evalCDP(`(() => ({
  pathname: location.pathname,
  inputs: Array.from(document.querySelectorAll('input, textarea, select')).map(i => ({
    type: i.type, name: i.name, placeholder: i.placeholder, label: i.getAttribute('aria-label'),
  })),
  buttons: Array.from(document.querySelectorAll('button')).slice(0,15).map(b => b.textContent.trim().slice(0,30)),
}))`);
console.log('form inspect:', JSON.stringify(inspect, null, 2));

process.exit(0);
