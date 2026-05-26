// Passo 9c: encontra MedNameInput (botão) → abre → digita TestMed
import { connect, screenshot, sleep } from './qa-cdp-helpers.mjs';

const { send, evalCDP } = await connect(9222);

const inspect = await evalCDP(`(() => {
  const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
  return {
    medBtns: btns.filter(b => /buscar medicamento|toque para buscar/i.test(b.textContent || '')).map(b => ({
      t: b.textContent.trim().slice(0,40),
      tag: b.tagName,
    })),
    allBtns: btns.slice(0, 25).map(b => b.textContent.trim().slice(0,40)).filter(t=>t.length>0),
  };
})()`);
console.log('search MedName:', JSON.stringify(inspect, null, 2));

// Click "Toque para buscar medicamento" — abre BottomSheet
const click1 = await evalCDP(`(() => {
  const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
  const target = btns.find(b => /toque para buscar medicamento/i.test(b.textContent || ''));
  if (!target) return { fail: 'no MedName btn' };
  target.click();
  return { clicked: true };
})()`);
console.log('click MedName:', JSON.stringify(click1));
await sleep(1500);
console.log('shot pós-MedName:', await screenshot(send, 'emul_step9c_medname_sheet'));

// Inspect sheet inputs
const sheetState = await evalCDP(`(() => ({
  inputs: Array.from(document.querySelectorAll('input,textarea')).map(i => ({ type: i.type, plc: i.placeholder })),
  bodySnip: document.body.textContent.slice(0,300),
}))`);
console.log('sheet state:', JSON.stringify(sheetState, null, 2));

process.exit(0);
