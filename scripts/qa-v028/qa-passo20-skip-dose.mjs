// Passo 20: clica em dose atrasada → DoseModal → Pular
import { connect, screenshot, sleep } from './qa-cdp-helpers.mjs';

const { send, evalCDP } = await connect(9222);

// Listar doses no Dashboard
const state = await evalCDP(`(() => {
  const items = Array.from(document.querySelectorAll('[class*="dose"], button, [role="button"]'));
  return {
    pathname: location.pathname,
    doseItems: items.filter(el => /TestMed_v0283/.test(el.textContent||'')).map(el => ({
      t: (el.textContent||'').trim().slice(0,80),
      tag: el.tagName,
    })).slice(0,10),
  };
})()`);
console.log('state:', JSON.stringify(state, null, 2));

// Click primeira dose atrasada
const click1 = await evalCDP(`(() => {
  const items = Array.from(document.querySelectorAll('button, [role="button"], li, article, div'));
  const target = items.find(el => /TestMed_v0283/.test(el.textContent||'') && /atrasada/i.test(el.textContent||''));
  if (!target) return { fail: 'no atrasada dose' };
  // Walk up pra clickable
  let t = target;
  while (t && !(t.onclick || /Press|Card|Btn/i.test(t.className||'') || t.tagName==='BUTTON')) {
    t = t.parentElement; if (!t) break;
  }
  if (!t) t = target;
  t.click();
  return { clicked: true, tag: t.tagName, txt: t.textContent.trim().slice(0,50) };
})()`);
console.log('click dose:', JSON.stringify(click1));
await sleep(1500);
console.log('shot:', await screenshot(send, 'emul_step20_dose_modal'));

// Inspect modal buttons
const modal = await evalCDP(`(() => {
  return {
    btns: Array.from(document.querySelectorAll('button')).map(b => ({ t: b.textContent.trim().slice(0,30), d: b.disabled })).slice(0,15),
    bodyHas: ['Tomada', 'Pular', 'Confirmar', 'Tomar'].map(k => ({ k, found: document.body.textContent.includes(k) })),
  };
})()`);
console.log('modal:', JSON.stringify(modal, null, 2));

process.exit(0);
