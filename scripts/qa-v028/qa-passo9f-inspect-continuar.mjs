// Encontra elemento clicável "Continuar com TestMed"
import { connect } from './qa-cdp-helpers.mjs';

const { evalCDP } = await connect(9222);

const inspect = await evalCDP(`(() => {
  const all = Array.from(document.querySelectorAll('*'));
  const continuar = all.find(el => /Continuar com.*TestMed/i.test((el.textContent||'').trim()) && el.children.length === 0);
  // Walk up to find a clickable parent
  let target = continuar;
  let walks = 0;
  while (target && walks < 8) {
    const isClickable = target.tagName === 'BUTTON' || target.role === 'button' || target.onclick || target.getAttribute('role') === 'button' || (target.style?.cursor === 'pointer') || /Press|Btn|Button/i.test(target.className || '');
    if (isClickable) break;
    target = target.parentElement;
    walks++;
  }
  if (!target) return { fail: 'no clickable ancestor' };
  // Click it
  target.click();
  return { tag: target.tagName, role: target.getAttribute('role'), className: target.className?.toString?.()?.slice(0,80), walks };
})()`);
console.log('click ancestor:', JSON.stringify(inspect, null, 2));
process.exit(0);
