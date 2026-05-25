// Passo 9d: digita TestMed no MedName sheet + seleciona/cria
import { connect, screenshot, sleep } from './qa-cdp-helpers.mjs';

const { send, evalCDP } = await connect(9222);

// Digita TestMed_v0283 no input
const fill = await evalCDP(`(() => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  const input = Array.from(document.querySelectorAll('input')).find(i => /paracetamol|buscar/i.test(i.placeholder || ''));
  if (!input) return { fail: 'no input' };
  input.focus();
  setter.call(input, 'TestMed_v0283');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return { val: input.value };
})()`);
console.log('fill:', JSON.stringify(fill));
await sleep(1500);
console.log('shot:', await screenshot(send, 'emul_step9d_after_type'));

// Inspect for suggestions / "Usar TestMed_v0283" button
const opts = await evalCDP(`(() => ({
  bodySnip: document.body.textContent.trim().slice(0,500),
  options: Array.from(document.querySelectorAll('button, [role="option"], li')).map(el => el.textContent.trim()).filter(t => t.length>0 && t.length<80).slice(0,15),
}))`);
console.log('opts:', JSON.stringify(opts, null, 2));

process.exit(0);
