export const fmtInt = (n) => Math.round(n).toLocaleString('en-US');
export const signed = (v, d = 2) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(d)}`;
export const fmtP = (p) => (p == null ? '—' : p < 0.001 ? 'p < 0.001' : `p = ${p.toFixed(3)}`);
export const money = (v, currency) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Plain-language verdict for a trend result. */
export function verdict(tr, { unit = '°C', per = 'decade', scale = 10, digits = 2, subject = 'It' } = {}) {
  if (!tr) return { tone: 'none', text: 'Not enough data to test a trend yet.' };
  const s = tr.senSlopePerYear * scale;
  const dir = s > 0 ? 'rising' : 'falling';
  const rate = `${signed(s, digits)} ${unit}/${per}`;
  if (tr.mkP < 0.05) return { tone: s > 0 ? 'up' : 'down', text: `${subject} is ${dir} at ${rate}. That is statistically significant (${fmtP(tr.mkP)}).` };
  if (tr.mkP < 0.1) return { tone: 'weak', text: `${subject} may be ${dir} (${rate}), but the evidence is weak (${fmtP(tr.mkP)}). A longer record could settle it.` };
  return { tone: 'flat', text: `No significant trend (${rate}, ${fmtP(tr.mkP)}). Changes are within normal variability.` };
}
