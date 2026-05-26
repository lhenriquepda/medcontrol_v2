// QA Round 3 Passo 6: compartilhar paciente teste-plus → teste-free
import { connect, screenshot, sleep } from './qa-cdp-helpers.mjs';

const { send, evalCDP } = await connect(9222);

// Click paciente card
const click1 = await evalCDP(`(() => {
  const el = Array.from(document.querySelectorAll('a, button, [role="button"]')).find(e => /QA_R3_Paciente_v0283/.test(e.textContent||''));
  if (!el) return { fail: true };
  el.click();
  return { clicked: true };
})()`);
console.log('click patient:', JSON.stringify(click1));
await sleep(2000);

// Click Compartilhar paciente
const click2 = await evalCDP(`(() => {
  const el = Array.from(document.querySelectorAll('button, a, [role="button"]')).find(e => /Compartilhar paciente/i.test(e.textContent||''));
  if (!el) return { fail: true };
  el.click();
  return { clicked: true };
})()`);
console.log('click compartilhar:', JSON.stringify(click2));
await sleep(1500);

// Fill email + click Compartilhar
const fillShare = await evalCDP(`(() => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  const emailIn = Array.from(document.querySelectorAll('input')).find(i => i.type === 'email' || /pessoa@exemplo/.test(i.placeholder || ''));
  if (!emailIn) return { fail: 'no email' };
  setter.call(emailIn, 'teste-free@teste.com');
  emailIn.dispatchEvent(new Event('input', { bubbles: true }));
  emailIn.dispatchEvent(new Event('change', { bubbles: true }));
  return { val: emailIn.value };
})()`);
console.log('fill email:', JSON.stringify(fillShare));
await sleep(500);

const submitShare = await evalCDP(`(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => /^\\s*Compartilhar\\s*$/.test((b.textContent||'').trim()) && !b.disabled);
  if (!btn) return { fail: true };
  btn.click();
  return { clicked: true };
})()`);
console.log('submit share:', JSON.stringify(submitShare));

const t0 = Date.now();
for (let i = 1; i <= 15; i++) {
  await sleep(1000);
  const st = await evalCDP(`(() => ({
    hasTesteFree: /teste-free@teste\\.com/i.test(document.body.textContent),
    hasNinguem: /Ninguém ainda/i.test(document.body.textContent),
  }))`);
  if (st?.hasTesteFree && !st?.hasNinguem) {
    console.log('t=' + i + 's: SHARED em', Date.now()-t0, 'ms');
    break;
  }
}

console.log('shot:', await screenshot(send, 'emul_r3_passo6_share'));
process.exit(0);
