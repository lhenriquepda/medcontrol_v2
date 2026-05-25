// Passo 5b: preenche form + submit + valida que mutation NÃO ficou stuck
import { connect, screenshot, sleep } from './qa-cdp-helpers.mjs';

const { send, evalCDP } = await connect(9222);

// Preenche Nome + Idade (mínimo necessário)
const fill = await evalCDP(`(() => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  const inputs = Array.from(document.querySelectorAll('input'));
  const nome = inputs.find(i => /nome/i.test(i.placeholder || ''));
  const idade = inputs.find(i => /45|idade/i.test(i.placeholder || ''));

  if (nome) {
    setter.call(nome, 'QA_Paciente_v0283_01');
    nome.dispatchEvent(new Event('input', { bubbles: true }));
    nome.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (idade) {
    const setterNum = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setterNum.call(idade, '5');
    idade.dispatchEvent(new Event('input', { bubbles: true }));
    idade.dispatchEvent(new Event('change', { bubbles: true }));
  }
  return { nomeVal: nome?.value, idadeVal: idade?.value };
})()`);
console.log('fill:', JSON.stringify(fill));
await sleep(500);
console.log('shot pre-submit:', await screenshot(send, 'emul_step5b_pre_submit'));

// Click Cadastrar
const t0 = Date.now();
const sub = await evalCDP(`(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  const cad = btns.find(b => /^\\s*(Cadastrar|Salvar)\\b/i.test((b.textContent || '').trim()));
  if (!cad) return { fail: 'no btn Cadastrar', all: btns.slice(0,10).map(b => b.textContent.trim().slice(0,30)) };
  if (cad.disabled) return { fail: 'btn disabled', text: cad.textContent.trim() };
  cad.click();
  return { clicked: cad.textContent.trim() };
})()`);
console.log('submit:', JSON.stringify(sub));

// Poll a cada 1s ate vermos botao reaparecer enabled OU navegar pra outra rota
for (let i = 1; i <= 25; i++) {
  await sleep(1000);
  const status = await evalCDP(`(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const cad = btns.find(b => /^\\s*(Cadastrar|Salvar)\\b/i.test((b.textContent || '').trim()));
    return {
      pathname: location.pathname,
      cadDisabled: cad?.disabled ?? null,
      cadText: cad?.textContent.trim().slice(0,20) || null,
      toast: Array.from(document.querySelectorAll('[role="alert"], .toast, [class*="snackbar"]')).map(el => el.textContent.trim()).slice(0,3),
    };
  })()`);
  console.log(`t=${i}s:`, JSON.stringify(status));
  if (status?.pathname && status.pathname !== '/pacientes/novo') {
    console.log('NAVEGOU pra', status.pathname, '— PATIENT CREATED OK em', Date.now()-t0, 'ms');
    break;
  }
  if (status?.cadDisabled === false && i > 5) {
    console.log('Btn voltou enabled após', i, 's (sem nav) — pode ter dado erro/timeout');
  }
}

console.log('shot final:', await screenshot(send, 'emul_step5b_final'));

process.exit(0);
