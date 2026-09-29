// Only reviewed, exact plain-text formula strings are promoted to typeset math.
// All other formulas remain readable text; no imported question or file can supply HTML.
const reviewedLatex = new Map([
  ['c9-shm', ['x=A cos(ωt+φ), v=−Aω sin(ωt+φ), a=−ω²x', 'x=A\\cos(\\omega t+\\varphi),\\quad v=-A\\omega\\sin(\\omega t+\\varphi),\\quad a=-\\omega^2x']],
  ['c9-simple-pendulum', ['T=2π√(ℓ/g)', 'T=2\\pi\\sqrt{\\ell/g}']],
  ['c10-wave-quantities', ['u=λf=λ/T', 'u=\\lambda f=\\frac{\\lambda}{T}']],
  ['c10-standing', ['y=2A sin(kx)cos(ωt)', 'y=2A\\sin(kx)\\cos(\\omega t)']],
  ['c11-young', ['Δy=λL/d', '\\Delta y=\\frac{\\lambda L}{d}']],
  ['c11-single-slit', ['暗纹：a sinθ=mλ，m=±1,±2,…', '\\text{暗纹: }a\\sin\\theta=m\\lambda,\\quad m=\\pm1,\\pm2,\\ldots']],
  ['c12-ideal-gas', ['pV=νRT=N kB T', 'pV=\\nu RT=Nk_{\\mathrm B}T']],
  ['c13-first-law', ['ΔU=Q−W_by', '\\Delta U=Q-W_{\\mathrm{by}}']],
  ['c14-time-dilation', ['Δt=γΔτ', '\\Delta t=\\gamma\\Delta\\tau']],
  ['c15-photon-photoelectric', ['hf=φ+Kmax; eVs=Kmax', 'hf=\\varphi+K_{\\max};\\quad eV_s=K_{\\max}']],
  ['c16-conservation', ['Σ初态守恒量=Σ末态守恒量', '\\sum\\text{初态守恒量}=\\sum\\text{末态守恒量}']],
]);

export function formulaLatexFor(node) {
  if (typeof node?.formulaLatex === 'string' && node.formulaLatex.trim()) return node.formulaLatex;
  const reviewed = reviewedLatex.get(node?.id);
  return reviewed?.[0] === node?.formula ? reviewed[1] : null;
}

export function renderFormula(element, { text = '', latex = null } = {}, renderer = globalThis.katex) {
  if (!element) throw new TypeError('公式容器不能为空。');
  const fallback = String(text ?? '');
  if (typeof latex !== 'string' || !latex.trim() || typeof renderer?.render !== 'function') {
    element.textContent = fallback;
    return { rendered: false };
  }
  try {
    renderer.render(latex, element, {
      displayMode: false,
      throwOnError: true,
      trust: false,
      strict: 'warn',
      maxExpand: 1000,
      output: 'htmlAndMathml',
    });
    return { rendered: true };
  } catch {
    element.textContent = fallback;
    return { rendered: false };
  }
}
