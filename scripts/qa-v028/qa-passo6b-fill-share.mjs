// Passo 6b: preenche e-mail teste-free + click Compartilhar
import { connect, screenshot, sleep } from './qa-cdp-helpers.mjs';

const { send, evalCDP } = await connect(9222);

// Fill email input
const fill = await evalCDP(`(() => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  const emailIn = Array.from(document.querySelectorAll('input')).find(i => i.type === 'email' || /pessoa@exemplo|email|@/.test(i.placeholder || ''));
  if (!emailIn) return { fail: 'no email input' };
  setter.call(emailIn, 'teste-free@teste.com');
  emailIn.dispatchEvent(new Event('input', { bubbles: true }));
  emailIn.dispatchEvent(new Event('change', { bubbles: true }));
  return { val: emailIn.value };
})()`);
console.log('fill:', JSON.stringify(fill));
await sleep(500);

// Click Compartilhar
const t0 = Date.now();
const click = await evalCDP(`(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  // Encontra "Compartilhar" exato (não "Compartilhar paciente")
  const target = btns.find(b => /^\\s*Compartilhar\\s*$/.test((b.textContent || '').trim()));
  if (!target) return { fail: 'no exact Compartilhar btn', candidates: btns.map(b => b.textContent.trim().slice(0,30)).slice(0,10) };
  if (target.disabled) return { fail: 'btn disabled' };
  target.click();
  return { clicked: true };
})()`);
console.log('click:', JSON.stringify(click));

// Poll status
for (let i = 1; i <= 20; i++) {
  await sleep(1000);
  const st = await evalCDP(`(() => {
    const compartilhadoCom = document.body.textContent;
    return {
      hasTesteFreeShared: /teste-free@teste\\.com/i.test(compartilhadoCom),
      hasNinguem: /Ninguém ainda/i.test(compartilhadoCom),
      toast: Array.from(document.querySelectorAll('[role="alert"], [class*="toast"], [class*="snack"]')).map(el => el.textContent.trim()).slice(0,3),
      error: Array.from(document.querySelectorAll('[class*="error"]')).map(el => el.textContent.trim()).slice(0,3),
    };
  })()`);
  if (st.hasTesteFreeShared) {
    console.log('t=' + i + 's: share OK!', JSON.stringify(st), 'elapsed', Date.now()-t0, 'ms');
    break;
  }
  if (i === 5 || i === 10 || i === 20) console.log('t=' + i + 's:', JSON.stringify(st));
}

console.log('shot final:', await screenshot(send, 'emul_step6b_after_share'));
process.exit(0);
