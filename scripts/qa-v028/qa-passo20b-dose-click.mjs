// Click direct na BUTTON da dose atrasada
import { connect, screenshot, sleep } from './qa-cdp-helpers.mjs';

const { send, evalCDP } = await connect(9222);

const click = await evalCDP(`(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => /TestMed_v0283/.test(b.textContent||'') && /atrasada/i.test(b.textContent||''));
  if (!btn) return { fail: true };
  btn.click();
  return { clicked: true, t: btn.textContent.trim().slice(0,50) };
})()`);
console.log('click:', JSON.stringify(click));
await sleep(1500);
console.log('shot:', await screenshot(send, 'emul_step20b_after_click'));

const modal = await evalCDP(`(() => ({
  pathname: location.pathname,
  modalBtns: Array.from(document.querySelectorAll('[role="dialog"] button, [class*="modal"] button')).map(b => b.textContent.trim().slice(0,20)),
  pularBtn: Array.from(document.querySelectorAll('button')).find(b => /^Pular$/.test(b.textContent.trim()))?.outerHTML?.slice(0,200),
  tomadaBtn: Array.from(document.querySelectorAll('button')).find(b => /^Tomada$/.test(b.textContent.trim()))?.outerHTML?.slice(0,200),
}))`);
console.log('modal:', JSON.stringify(modal, null, 2));

process.exit(0);
