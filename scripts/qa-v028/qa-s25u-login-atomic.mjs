// Login atômico: fill + form.requestSubmit + verify
import { connect, screenshot, sleep } from './qa-cdp-helpers.mjs';

const { send, evalCDP } = await connect(9223);

const initial = await evalCDP(`(() => ({ pathname: location.pathname, hasEmail: !!document.querySelector('input[type="email"]'), hasPass: !!document.querySelector('input[type="password"]') }))`);
console.log('initial:', JSON.stringify(initial));

const fill = await evalCDP(`(() => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  const e = document.querySelector('input[type="email"]') || Array.from(document.querySelectorAll('input')).find(i => /email/i.test(i.placeholder||i.name||''));
  const p = document.querySelector('input[type="password"]');
  if (!e || !p) return { fail: 'inputs not found', e: !!e, p: !!p };
  setter.call(e, 'teste-free@teste.com');
  e.dispatchEvent(new Event('input', { bubbles: true }));
  e.dispatchEvent(new Event('change', { bubbles: true }));
  setter.call(p, '123456');
  p.dispatchEvent(new Event('input', { bubbles: true }));
  p.dispatchEvent(new Event('change', { bubbles: true }));
  return { eVal: e.value, pLen: p.value.length };
})()`);
console.log('fill:', JSON.stringify(fill));

await sleep(500);

// Verifica que os valores ficaram persistidos
const recheck = await evalCDP(`(() => {
  const e = document.querySelector('input[type="email"]');
  const p = document.querySelector('input[type="password"]');
  return { eVal: e?.value, pLen: p?.value.length };
})()`);
console.log('recheck:', JSON.stringify(recheck));

// Submita form
const sub = await evalCDP(`(() => {
  const form = document.querySelector('form');
  if (!form) return { noForm: true };
  // Procura botão submit; se não existe, requestSubmit do form
  const btn = form.querySelector('button[type="submit"]') || Array.from(form.querySelectorAll('button')).find(b => /Entrar/i.test(b.textContent||''));
  if (btn) { btn.click(); return { btnClicked: btn.textContent.trim(), btnType: btn.type }; }
  form.requestSubmit?.();
  return { reqSubmit: true };
})()`);
console.log('submit:', JSON.stringify(sub));

await sleep(10000);
console.log('shot 10s:', await screenshot(send, 'S25U_login_10s_after'));

const final = await evalCDP(`(() => ({
  pathname: location.pathname,
  title: document.title,
  body: document.body.textContent.trim().slice(0, 200),
  greetings: document.querySelector('[class*="greeting"], h1, h2')?.textContent?.trim()?.slice(0,60),
}))`);
console.log('final:', JSON.stringify(final, null, 2));

process.exit(0);
