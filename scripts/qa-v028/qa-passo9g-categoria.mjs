// Click Escolher categoria via CDP + seleciona Outros
import { connect, screenshot, sleep } from './qa-cdp-helpers.mjs';

const { send, evalCDP } = await connect(9222);

const click1 = await evalCDP(`(() => {
  const btns = Array.from(document.querySelectorAll('button, [role="button"], select, [class*="CategoryPicker"], [class*="picker"], [class*="select"]'));
  const target = btns.find(b => /escolher categoria/i.test((b.textContent||'').trim()));
  if (!target) return { fail: 'no btn' };
  target.click();
  return { clicked: target.textContent.trim().slice(0,30), tag: target.tagName };
})()`);
console.log('click Categoria:', JSON.stringify(click1));
await sleep(1500);
console.log('shot:', await screenshot(send, 'emul_step9g_cat_open'));

const cats = await evalCDP(`(() => {
  const all = Array.from(document.querySelectorAll('button, [role="option"], li, div'));
  return all.map(el => (el.textContent||'').trim()).filter(t => /^(Antibiótico|Antibiotico|Analgésico|Antialérgico|Antitérmico|Anti-?inflamatório|Antidepressivo|Anti-?hipertensivo|Outros|Outro|Vitamina|Probiótico|Hormonio|Suplemento|Não|Geral|Sintomático)/i.test(t)).slice(0, 20);
})()`);
console.log('cats:', JSON.stringify(cats));

process.exit(0);
