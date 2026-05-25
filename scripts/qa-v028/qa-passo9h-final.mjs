// Passo 9h: seleciona Outro + completa form + Criar tratamento
import { connect, screenshot, sleep } from './qa-cdp-helpers.mjs';

const { send, evalCDP } = await connect(9222);

// Click "Outro"
const click1 = await evalCDP(`(() => {
  const all = Array.from(document.querySelectorAll('button, [role="option"], li, div'));
  // Filtra o item exato "Outro"
  const target = all.find(el => el.textContent?.trim() === 'Outro' && el.children.length === 0);
  if (!target) return { fail: 'no Outro' };
  // Walk up to clickable
  let t = target;
  while (t && t.tagName !== 'BUTTON' && t.getAttribute('role') !== 'option' && !/^LI$/.test(t.tagName)) {
    t = t.parentElement;
    if (!t) break;
  }
  if (!t) return { fail: 'no clickable ancestor' };
  t.click();
  return { clicked: t.textContent.trim().slice(0,20), tag: t.tagName };
})()`);
console.log('click Outro:', JSON.stringify(click1));
await sleep(1500);

// Calculate target time +15min from now (re-check)
const now = new Date();
now.setMinutes(now.getMinutes() + 15);
const targetHHMM = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
console.log('target HH:MM:', targetHHMM);

// Re-fill hora 1ª dose + duração (caso tenha reset)
const fillRest = await evalCDP(`(() => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  const inputs = Array.from(document.querySelectorAll('input'));
  const timeIn = inputs.find(i => i.type === 'time');
  const durNum = inputs.find(i => i.type === 'number');
  if (timeIn) {
    setter.call(timeIn, '${targetHHMM}');
    timeIn.dispatchEvent(new Event('input', { bubbles: true }));
    timeIn.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (durNum) {
    setter.call(durNum, '1');
    durNum.dispatchEvent(new Event('input', { bubbles: true }));
    durNum.dispatchEvent(new Event('change', { bubbles: true }));
  }
  return { timeVal: timeIn?.value, durVal: durNum?.value };
})()`);
console.log('fillRest:', JSON.stringify(fillRest));
await sleep(500);
console.log('shot pré-criar:', await screenshot(send, 'emul_step9h_pre_criar'));

// Click Criar tratamento
const t0 = Date.now();
const submit = await evalCDP(`(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => /^Criar tratamento$/.test((b.textContent||'').trim()));
  if (!btn) return { fail: 'no Criar btn' };
  if (btn.disabled) return { fail: 'btn disabled' };
  btn.click();
  return { clicked: true };
})()`);
console.log('submit:', JSON.stringify(submit));

// Poll
for (let i = 1; i <= 30; i++) {
  await sleep(1000);
  const st = await evalCDP(`(() => ({ pathname: location.pathname }))`);
  if (st?.pathname && st.pathname !== '/tratamento/novo') {
    console.log('t=' + i + 's: NAVEGOU pra', st.pathname, '— OK em', Date.now()-t0, 'ms');
    break;
  }
  if (i === 30) console.log('t=30s: AINDA em /tratamento/novo — BUG #0025 instance?');
}

console.log('shot final:', await screenshot(send, 'emul_step9h_final'));
process.exit(0);
