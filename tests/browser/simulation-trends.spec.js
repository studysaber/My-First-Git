import { test, expect } from '@playwright/test';

async function mount(page, id) {
  await page.goto('/');
  await page.evaluate(async (simulationId) => {
    const { mountSimulation } = await import('/My-First-Git/assets/simulations.js');
    const host = document.createElement('div');
    host.id = 'physics-trend-host';
    document.body.append(host);
    window.physicsTrendCleanup = mountSimulation(host, simulationId);
  }, id);
  return page.locator('#physics-trend-host');
}

test('wave amplitude changes plotted displacement on fixed axes', async ({ page }) => {
  const host = await mount(page, 'wave');
  await host.locator('[data-action="pause"]').click();
  const read = () => host.locator('[data-wave-path]').getAttribute('d');
  const first = await read();
  await host.locator('[data-param="amplitude"]').evaluate((element) => { element.value = '0.005'; element.dispatchEvent(new Event('input', { bubbles: true })); });
  const second = await read();
  expect(first).not.toBe(second);
  await expect(host.locator('svg')).toHaveAttribute('aria-label', /x：0—6 m，y：−11—11 mm/);
});

test('paused pendulum steps by 0.1 s with a fixed pivot and physical rope length', async ({ page }) => {
  const host = await mount(page, 'pendulum');
  await host.locator('[data-action="pause"]').click();
  const read = () => host.locator('svg').evaluate((svg) => {
    const pivot = svg.querySelector('circle:not([data-pendulum-bob])');
    const bob = svg.querySelector('[data-pendulum-bob]');
    return { pivot: [Number(pivot.getAttribute('cx')), Number(pivot.getAttribute('cy'))], bob: [Number(bob.getAttribute('cx')), Number(bob.getAttribute('cy'))] };
  });
  const before = await read();
  const timeBefore = Number((await host.locator('[data-role="result"]').textContent()).match(/t = ([\d.]+) s/)[1]);
  await host.locator('[data-action="step"]').click();
  const after = await read();
  const timeAfter = Number((await host.locator('[data-role="result"]').textContent()).match(/t = ([\d.]+) s/)[1]);
  expect(after.pivot).toEqual(before.pivot);
  expect(Math.hypot(after.bob[0] - after.pivot[0], after.bob[1] - after.pivot[1])).toBeCloseTo(50, 1);
  expect(timeAfter - timeBefore).toBeCloseTo(0.1, 2);
});

test('Maxwell hotter nitrogen peak moves right and lowers on one axis', async ({ page }) => {
  const host = await mount(page, 'maxwell');
  const paths = host.locator('svg path');
  const reference = await paths.nth(1).getAttribute('d');
  await host.locator('[data-param="temperature"]').evaluate((element) => { element.value = '900'; element.dispatchEvent(new Event('input', { bubbles: true })); });
  const baseline = await paths.nth(1).getAttribute('d');
  const hotter = await paths.nth(2).getAttribute('d');
  expect(await paths.nth(1).getAttribute('stroke-dasharray')).not.toBe(await paths.nth(2).getAttribute('stroke-dasharray'));
  expect(baseline).toBe(reference);
  const extremum = (path) => [...path.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((match) => ({ x: Number(match[1]), y: Number(match[2]) })).reduce((best, point) => point.y < best.y ? point : best);
  expect(extremum(hotter).x).toBeGreaterThan(extremum(baseline).x);
  expect(extremum(hotter).y).toBeGreaterThan(extremum(baseline).y);
});

test('Carnot equal temperatures collapse the net work and double slit keeps physical screen scale', async ({ page }) => {
  const carnot = await mount(page, 'carnot');
  await carnot.locator('[data-param="hotK"]').evaluate((element) => { element.value = '300'; element.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(carnot.locator('[data-role="result"]')).toContainText('W = 0 J');
  await expect(carnot.locator('[data-cycle-segment]')).toHaveCount(4);
  await page.evaluate(() => window.physicsTrendCleanup());
  const slit = await mount(page, 'interference');
  await expect(slit.locator('svg')).toHaveAttribute('aria-label', /−30—30 mm/);
  await expect(slit.locator('[data-slit]')).toHaveCount(2);
});

test('600 and 700 nm double slit maxima land at 12 and 14 mm on the same screen', async ({ page }) => {
  const host = await mount(page, 'interference');
  const set = async (name, value) => host.locator(`[data-param="${name}"]`).evaluate((element, next) => { element.value = next; element.dispatchEvent(new Event('input', { bubbles: true })); }, value);
  await set('slitSeparationMm', '0.1'); await set('screenDistance', '2');
  const opacityAt = (millimetres) => host.locator('svg line[x1="215"]').nth(Math.round((millimetres + 30) / 0.05)).getAttribute('opacity');
  await set('wavelengthNm', '600');
  expect(Number(await opacityAt(12))).toBeCloseTo(1, 2);
  expect(Number(await opacityAt(6))).toBeCloseTo(0, 2);
  await set('wavelengthNm', '700');
  expect(Number(await opacityAt(14))).toBeCloseTo(1, 2);
  expect(Number(await opacityAt(7))).toBeCloseTo(0, 2);
});

test('sub-threshold light shows no electron energy readout with a directed photon', async ({ page }) => {
  const host = await mount(page, 'photoelectric');
  await host.locator('[data-param="workFunctionEv"]').evaluate((element) => { element.value = '4'; element.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(host.locator('[data-role="result"]')).toContainText('无光电子逸出');
  await expect(host.locator('[data-role="result"]')).toContainText('不适用');
  await expect(host.locator('svg circle')).toHaveCount(0);
  await expect(host.locator('svg')).toHaveAttribute('aria-label', /阈频以下无逸出/);
  await expect(host.locator('svg')).toContainText('光 → 金属');
});

test('returning to a hidden experiment keeps it paused until learner resumes', async ({ page }) => {
  const host = await mount(page, 'wave');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(host.locator('[data-action="pause"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(host.locator('[data-action="pause"]')).toHaveText('继续演示');
});
