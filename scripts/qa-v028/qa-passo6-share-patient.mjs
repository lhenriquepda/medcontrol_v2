// Passo 6: Compartilha QA_Paciente_v0283_01 com teste-free
import { connect, screenshot, sleep } from './qa-cdp-helpers.mjs';

const { send, evalCDP } = await connect(9222);

// 6.1) Click no paciente (lista)
const click1 = await evalCDP(`(() => {
  // PatientCard tem onClick navega pra /pacientes/:id
  const candidates = Array.from(document.querySelectorAll('a, button, [role="button"], [data-patient-id], article, li'));
  const patientLink = candidates.find(el => /QA_Paciente_v0283/.test(el.textContent || '') && (el.tagName==='A' || el.tagName==='LI' || el.tagName==='ARTICLE' || el.onclick));
  if (!patientLink) return { fail: 'no patient card' };
  patientLink.click();
  return { clicked: true, tag: patientLink.tagName };
})()`);
console.log('6.1 click patient:', JSON.stringify(click1));
await sleep(1500);
console.log('6.1 shot:', await screenshot(send, 'emul_step6_1_patient_detail'));

// 6.2) Encontra botão Compartilhar
const inspect = await evalCDP(`(() => {
  const all = Array.from(document.querySelectorAll('button, a, [role="button"]'));
  return {
    pathname: location.pathname,
    items: all.map(el => ({
      t: (el.textContent || '').trim().slice(0,50),
      al: el.getAttribute('aria-label') || '',
    })).filter(x => x.t.length>0 || x.al.length>0).slice(0,30),
  };
})()`);
console.log('6.2 inspect:', JSON.stringify(inspect, null, 2));

// 6.3) Click "Compartilhar"
const click2 = await evalCDP(`(() => {
  const all = Array.from(document.querySelectorAll('button, a, [role="button"]'));
  const compartilhar = all.find(el => /compartilhar/i.test((el.textContent || '').trim()) || /compartilhar/i.test(el.getAttribute('aria-label') || ''));
  if (!compartilhar) return { fail: 'no compartilhar btn' };
  compartilhar.click();
  return { clicked: compartilhar.textContent.trim().slice(0,40) || compartilhar.getAttribute('aria-label') };
})()`);
console.log('6.3 click compartilhar:', JSON.stringify(click2));
await sleep(1500);
console.log('6.3 shot:', await screenshot(send, 'emul_step6_3_share_sheet'));

process.exit(0);
