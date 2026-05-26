// Logout S25U: click "Sair" + confirm
import { connect, screenshot, sleep } from './qa-cdp-helpers.mjs';

const { send, evalCDP } = await connect(9223);

// Click "Sair"
const click1 = await evalCDP(`(() => {
  const all = Array.from(document.querySelectorAll('button, a, [role="button"]'));
  const sair = all.find(el => (el.textContent || '').trim() === 'Sair');
  if (!sair) return { found: false };
  sair.click();
  return { found: true, tag: sair.tagName };
})()`);
console.log('click Sair:', JSON.stringify(click1));
await sleep(1500);
console.log('shot pós-Sair:', await screenshot(send, 'S25U_after_sair_click'));

// Confirma se aparecer dialog
const dialog = await evalCDP(`(() => {
  const all = Array.from(document.querySelectorAll('button, a, [role="button"]'));
  const buttons = all.map(el => (el.textContent || '').trim()).filter(t => t.length>0 && t.length<60);
  // Look for confirm dialog button "Sair", "Confirmar", "Sim", etc
  return {
    pathname: location.pathname,
    items: buttons.slice(0,30),
  };
})()`);
console.log('after Sair items:', JSON.stringify(dialog, null, 2));

// Se há dialog de confirmação, clica em Sair/Confirmar/Sim
const confirmClick = await evalCDP(`(() => {
  const all = Array.from(document.querySelectorAll('button, a, [role="button"]'));
  // Procura dentro de [role="dialog"] preferencialmente
  const inDialog = Array.from(document.querySelectorAll('[role="dialog"] button'));
  const target = inDialog.find(el => /^(Sair|Confirmar|Sim|OK|Yes)$/i.test((el.textContent || '').trim()))
    || all.find(el => /^(Confirmar|Sim)$/i.test((el.textContent || '').trim()));
  if (target) { target.click(); return { clicked: target.textContent.trim() }; }
  return { noDialog: true };
})()`);
console.log('confirm:', JSON.stringify(confirmClick));
await sleep(2000);
console.log('shot final:', await screenshot(send, 'S25U_after_logout'));

process.exit(0);
