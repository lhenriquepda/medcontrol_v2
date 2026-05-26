// Round 3 Passo 9: cria tratamento TestMed_R3
import { connect, screenshot, sleep } from './qa-cdp-helpers.mjs';

const { send, evalCDP } = await connect(9222);

// Navega pra patient detail
const clickPatient = await evalCDP(`(() => {
  const el = Array.from(document.querySelectorAll('a, button')).find(e => /QA_R3_Paciente_v0283/.test(e.textContent||''));
  if (!el) return { fail: true };
  el.click(); return { clicked: true };
})()`);
console.log('click patient:', JSON.stringify(clickPatient));
await sleep(1500);

// Click "Novo tratamento"
const clickNovo = await evalCDP(`(() => {
  const el = Array.from(document.querySelectorAll('button, a, [role="button"]')).find(e => /Novo tratamento|Novo$/i.test((e.textContent||'').trim()) || /Novo tratamento|Novo paciente|Novo \\(/i.test(e.getAttribute('aria-label')||''));
  if (!el) return { fail: true };
  el.click(); return { clicked: true };
})()`);
console.log('click novo:', JSON.stringify(clickNovo));
await sleep(2000);

// Click MedNameInput
const clickMedName = await evalCDP(`(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => /toque para buscar medicamento/i.test(b.textContent||''));
  if (!btn) return { fail: true };
  btn.click(); return { clicked: true };
})()`);
console.log('click medName:', JSON.stringify(clickMedName));
await sleep(1500);

// Digita TestMed_R3
const typeMed = await evalCDP(`(() => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  const i = Array.from(document.querySelectorAll('input')).find(i => /paracetamol|buscar/i.test(i.placeholder||''));
  if (!i) return { fail: true };
  setter.call(i, 'TestMed_R3');
  i.dispatchEvent(new Event('input', { bubbles: true }));
  i.dispatchEvent(new Event('change', { bubbles: true }));
  return { val: i.value };
})()`);
console.log('type med:', JSON.stringify(typeMed));
await sleep(1500);

console.log('shot pré-continuar:', await screenshot(send, 'emul_r3_p9_pre_continuar'));

process.exit(0);
