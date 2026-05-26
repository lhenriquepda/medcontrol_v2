// Passo 5: Cadastra paciente em teste-plus via UI no emul-5554
// Valida BUG #0025 fix (mutation com withTimeout não fica stuck)
import { connect, screenshot, sleep } from './qa-cdp-helpers.mjs';

const { send, evalCDP } = await connect(9222);

console.log('Step 5.0 initial:', await screenshot(send, 'emul_step5_0_initial'));

// 5.1) Navega para Pacientes (bottom nav)
const click1 = await evalCDP(`(() => {
  const link = Array.from(document.querySelectorAll('a')).find(a => (a.textContent||'').trim() === 'Pacientes');
  if (!link) return { fail: true };
  link.click();
  return { ok: true };
})()`);
console.log('5.1 click Pacientes:', JSON.stringify(click1));
await sleep(1500);
console.log('5.1 shot:', await screenshot(send, 'emul_step5_1_pacientes'));

// 5.2) Click "+" header (criar paciente)
const click2 = await evalCDP(`(() => {
  // Procura botão "+" header Pacientes. Pode ser aria-label "novo paciente" ou similar
  const candidates = Array.from(document.querySelectorAll('button, a, [role="button"]'));
  const target = candidates.find(b => {
    const t = (b.textContent || '').trim();
    const al = b.getAttribute('aria-label') || '';
    return /^\\+$/.test(t) || /novo paciente|new patient|adicionar paciente/i.test(al) || /novo paciente|adicionar/i.test(t);
  });
  if (!target) {
    return { fail: 'no btn', candidates: candidates.slice(0,15).map(b => ({ t: (b.textContent||'').trim().slice(0,30), al: b.getAttribute('aria-label')?.slice(0,30) })) };
  }
  target.click();
  return { ok: true, text: target.textContent.trim().slice(0,20), al: target.getAttribute('aria-label') };
})()`);
console.log('5.2 click +:', JSON.stringify(click2, null, 2));
await sleep(2000);
console.log('5.2 shot:', await screenshot(send, 'emul_step5_2_after_plus'));

// 5.3) Inspeciona inputs do form Novo Paciente
const inspect = await evalCDP(`(() => {
  return {
    pathname: location.pathname,
    inputs: Array.from(document.querySelectorAll('input, textarea, select')).map(i => ({
      type: i.type,
      name: i.name,
      placeholder: i.placeholder,
      label: i.getAttribute('aria-label') || i.previousElementSibling?.textContent?.trim()?.slice(0,30) || null,
      required: i.required,
    })),
    buttons: Array.from(document.querySelectorAll('button')).slice(0,10).map(b => ({
      t: b.textContent.trim().slice(0,30),
      d: b.disabled,
      type: b.type,
    })),
  };
})()`);
console.log('5.3 form inspect:', JSON.stringify(inspect, null, 2));

process.exit(0);
