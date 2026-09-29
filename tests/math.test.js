import test from 'node:test';
import assert from 'node:assert/strict';
import { formulaLatexFor, renderFormula } from '../dist/assets/math.js';

test('formula renderer uses local KaTeX with untrusted commands disabled', () => {
  const element = { textContent: '' };
  const calls = [];
  const renderer = { render(...args) { calls.push(args); } };
  const result = renderFormula(element, { text: 'x²', latex: 'x^2' }, renderer);
  assert.equal(result.rendered, true);
  assert.equal(calls[0][0], 'x^2');
  assert.equal(calls[0][1], element);
  assert.equal(calls[0][2].trust, false);
  assert.equal(calls[0][2].throwOnError, true);
});

test('missing or invalid math assets fall back to safe plain text', () => {
  const element = { textContent: '' };
  assert.equal(renderFormula(element, { text: '<img src=x>', latex: 'x' }, null).rendered, false);
  assert.equal(element.textContent, '<img src=x>');
  assert.equal(renderFormula(element, { text: 'E=mc²', latex: '\\bad' }, { render() { throw new Error('invalid'); } }).rendered, false);
  assert.equal(element.textContent, 'E=mc²');
});

test('authored math mapping only applies to the exact formula it reviewed', () => {
  assert.equal(formulaLatexFor({ id: 'c9-shm', formula: 'x=A cos(ωt+φ), v=−Aω sin(ωt+φ), a=−ω²x' }),
    'x=A\\cos(\\omega t+\\varphi),\\quad v=-A\\omega\\sin(\\omega t+\\varphi),\\quad a=-\\omega^2x');
  assert.equal(formulaLatexFor({ id: 'c9-shm', formula: 'changed formula' }), null);
});
