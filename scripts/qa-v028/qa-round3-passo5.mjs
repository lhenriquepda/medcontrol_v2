// QA round 3 Passo 5: criar paciente em teste-plus
import { connect, screenshot, sleep } from './qa-cdp-helpers.mjs';

const { send, evalCDP } = await connect(9222);

// Click "Cadastrar primeiro paciente" OR "+ Novo paciente"
const click = await evalCDP(`(() => {
  const btns = Array.from(document.querySelectorAll('button, a, [role="button"]'));
  const t = btns.find(b => /Cadastrar primeiro paciente|Novo paciente/i.test((b.textContent||'').trim() || (b.getAttribute('aria-label')||'')));
  if (!t) return { fail: true };
  t.click();
  return { clicked: t.textContent.trim().slice(0,30) || t.getAttribute('aria-label') };
})()`);
console.log('click:', JSON.stringify(click));
await sleep(2000);

// Preenche
const fill = await evalCDP(`(() => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  const inputs = Array.from(document.querySelectorAll('input'));
  const nome = inputs.find(i => /nome/i.test(i.placeholder || ''));
  const idade = inputs.find(i => /45|idade/i.test(i.placeholder || ''));
  if (nome) {
    setter.call(nome, 'QA_R3_Paciente_v0283');
    nome.dispatchEvent(new Event('input', { bubbles: true }));
    nome.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (idade) {
    setter.call(idade, '7');
    idade.dispatchEvent(new Event('input', { bubbles: true }));
    idade.dispatchEvent(new Event('change', { bubbles: true }));
  }
  return { nome: nome?.value, idade: idade?.value };
})()`);
console.log('fill:', JSON.stringify(fill));
await sleep(500);

// Submit
const t0 = Date.now();
const sub = await evalCDP(`(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => /^\\s*Cadastrar (paciente|primeiro)/i.test((b.textContent||'').trim()) || /^Cadastrar$/i.test((b.textContent||'').trim()));
  if (!btn) return { fail: 'no btn' };
  if (btn.disabled) return { fail: 'disabled' };
  btn.click();
  return { clicked: btn.textContent.trim() };
})()`);
console.log('submit:', JSON.stringify(sub));

// Poll status
for (let i = 1; i <= 30; i++) {
  await sleep(1000);
  const st = await evalCDP(`(() => ({ pathname: location.pathname }))`);
  if (st?.pathname && !st.pathname.includes('/pacientes/novo')) {
    console.log('t=' + i + 's: NAVEGOU pra', st.pathname, '— OK em', Date.now()-t0, 'ms');
    break;
  }
  if (i === 30) console.log('t=30s: STUCK em /pacientes/novo — BUG #0025 ainda!');
}

console.log('shot:', await screenshot(send, 'emul_r3_passo5_final'));
process.exit(0);
