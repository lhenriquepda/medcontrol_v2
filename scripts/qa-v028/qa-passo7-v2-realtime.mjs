// Passo 7 v2: Check Realtime delivery on S25U
// (1) Fecha share sheet emul, (2) navega S25U pra Pacientes, (3) observa se QA_Paciente aparece
import { connect, screenshot, sleep } from './qa-cdp-helpers.mjs';

// emul-5554: fecha share sheet via Fechar btn
const emul = await connect(9222);
const closeSheet = await emul.evalCDP(`(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => /^\\s*Fechar\\s*$/.test((b.textContent || '').trim()));
  if (btn) { btn.click(); return { closed: true }; }
  return { noFechar: true };
})()`);
console.log('emul close sheet:', JSON.stringify(closeSheet));
emul.ws.close();

await sleep(1500);

// S25U: navega para Pacientes + observa
const s25 = await connect(9223);
const s25initial = await s25.evalCDP(`(() => ({
  pathname: location.pathname,
  hasQA: /QA_Paciente_v0283_01/.test(document.body.textContent),
  email: /teste-free/i.test(document.body.textContent),
}))`);
console.log('S25U initial:', JSON.stringify(s25initial));
console.log('S25U shot inicial:', await screenshot(s25.send, 'S25U_step7_v2_initial'));

// Se não está em Pacientes, navega
if (s25initial && !s25initial.pathname?.startsWith('/pacientes')) {
  await s25.evalCDP(`(() => {
    const link = Array.from(document.querySelectorAll('a')).find(a => (a.textContent||'').trim() === 'Pacientes');
    if (link) link.click();
  })()`);
  await sleep(2000);
}

const s25after = await s25.evalCDP(`(() => ({
  pathname: location.pathname,
  hasQA: /QA_Paciente_v0283_01/.test(document.body.textContent),
  bodySnip: document.body.textContent.trim().slice(0, 500),
}))`);
console.log('S25U pós nav:', JSON.stringify(s25after));
console.log('S25U shot pós-nav:', await screenshot(s25.send, 'S25U_step7_v2_after_nav'));

// Se já apareceu, ótimo. Se não, aguarda 10s pra Realtime entregar.
if (s25after && !s25after.hasQA) {
  console.log('NAO APARECEU AINDA — aguardando 10s Realtime...');
  for (let i = 1; i <= 10; i++) {
    await sleep(1000);
    const st = await s25.evalCDP(`(() => ({ hasQA: /QA_Paciente_v0283_01/.test(document.body.textContent) }))`);
    if (st?.hasQA) {
      console.log('t=' + i + 's: APARECEU via Realtime!');
      break;
    }
    if (i === 10) console.log('NAO apareceu em 10s via Realtime');
  }
}
console.log('S25U final:', await screenshot(s25.send, 'S25U_step7_v2_final'));
s25.ws.close();

process.exit(0);
