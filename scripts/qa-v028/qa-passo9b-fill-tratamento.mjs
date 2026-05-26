// Passo 9b: preenche tratamento form
import { connect, screenshot, sleep } from './qa-cdp-helpers.mjs';

const { send, evalCDP } = await connect(9222);

// Calcula horário +15min HH:MM
const now = new Date();
now.setMinutes(now.getMinutes() + 15);
const targetHHMM = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
const targetISO_date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
console.log('target dose HH:MM:', targetHHMM, 'date:', targetISO_date);

// Step A: Click MedNameInput → digita TestMed → seleciona "criar"
const clickMedInput = await evalCDP(`(() => {
  const inputs = Array.from(document.querySelectorAll('input'));
  const med = inputs.find(i => /buscar medicamento/i.test(i.placeholder || ''));
  if (!med) return { noMed: true };
  med.focus(); med.click();
  return { focused: true, plc: med.placeholder };
})()`);
console.log('clickMed:', JSON.stringify(clickMedInput));
await sleep(1500);
console.log('shot pós-click med:', await screenshot(send, 'emul_step9_med_open'));

// Step B: Procura input medicamento (pode ser BottomSheet)
const inspect = await evalCDP(`(() => {
  const allInputs = Array.from(document.querySelectorAll('input,textarea'));
  return {
    pathname: location.pathname,
    inputs: allInputs.map(i => ({ type: i.type, plc: i.placeholder, val: i.value, label: i.getAttribute('aria-label') })),
  };
})()`);
console.log('inputs após click med:', JSON.stringify(inspect, null, 2));

process.exit(0);
