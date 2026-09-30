import { test, expect } from '@playwright/test';

const setTemperature = (page, name, value) => page.locator(`[data-param="${name}"]`).evaluate((control, next) => {
  control.value = String(next);
  control.dispatchEvent(new Event('input', { bubbles: true }));
}, value);

async function readCycle(page) {
  return page.locator('.simulation-plot').evaluate((svg) => ({
    states: [...svg.querySelectorAll('[data-cycle-state]')].map((point) => ({
      number: point.dataset.cycleState,
      x: Number(point.getAttribute('cx')), y: Number(point.getAttribute('cy')),
    })),
    segments: [...svg.querySelectorAll('[data-cycle-segment]')].map((curve) => ({
      points: [...curve.getAttribute('d').matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((match) => ({ x: Number(match[1]), y: Number(match[2]) })),
      dash: curve.getAttribute('stroke-dasharray') ?? '',
      arrow: curve.getAttribute('marker-end'),
    })),
    ticks: [...svg.querySelectorAll('[data-cycle-tick]')].map((tick) => ({ axis: tick.dataset.cycleTick, value: Number(tick.textContent) })),
  }));
}

function expectPhysicalCycle(plot, hotK, coldK) {
  // Independent ideal-gas and adiabatic relationships, in the chart's declared axes.
  const R = 8.31446261815324;
  const expansion = (hotK / coldK) ** 2.5;
  const volumes = [1, 2, 2 * expansion, expansion];
  const pressures = [R * hotK, R * hotK / 2, R * coldK / (2 * expansion), R * coldK / expansion];
  const maxVolume = 2 * expansion * 1.05;
  const maxPressure = R * hotK * 1.1;
  const pressuresOnAxis = plot.ticks.filter((tick) => tick.axis === 'pressure');
  const volumesOnAxis = plot.ticks.filter((tick) => tick.axis === 'volume');
  [0.25, 0.5, 0.75].forEach((fraction, index) => {
    expect(Math.abs(pressuresOnAxis[index].value - maxPressure * fraction)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(volumesOnAxis[index].value - maxVolume * fraction)).toBeLessThanOrEqual(0.05 + 1e-9);
  });
  expect(plot.states.map((point) => point.number)).toEqual(['1', '2', '3', '4']);
  plot.states.forEach((point, index) => {
    expect(point.x).toBeCloseTo(50 + volumes[index] / maxVolume * 270, 1);
    expect(point.y).toBeCloseTo(190 - pressures[index] / maxPressure * 160, 1);
    const curve = plot.segments[index].points;
    expect(curve[0]).toEqual({ x: point.x, y: point.y });
    expect(curve.at(-1)).toEqual({ x: plot.states[(index + 1) % 4].x, y: plot.states[(index + 1) % 4].y });
    const invariant = curve.map(({ x, y }) => {
      const volume = (x - 50) / 270 * maxVolume;
      const pressure = (190 - y) / 160 * maxPressure;
      return pressure * volume ** (index % 2 ? 1.4 : 1);
    });
    invariant.forEach((value) => expect(Math.abs(value / invariant[0] - 1)).toBeLessThan(0.015));
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('./#view=study&node=c13-cycle-carnot&tab=experiment');
});

test('Carnot state labels and directed process curves follow physical states after temperature changes', async ({ page }) => {
  await expect(page.locator('[data-cycle-state]')).toHaveCount(4);
  await expect(page.locator('[data-cycle-segment][marker-end]')).toHaveCount(4);
  for (const number of ['1', '2', '3', '4']) {
    await expect(page.locator(`[data-cycle-state-label="${number}"]`)).toBeVisible();
    await expect(page.locator(`[data-cycle-state-label="${number}"]`)).toHaveText(number);
  }
  for (const name of ['等温膨胀', '绝热膨胀', '等温压缩', '绝热压缩']) {
    await expect(page.locator('.simulation-plot')).toContainText(name);
  }
  let plot = await readCycle(page);
  expectPhysicalCycle(plot, 600, 300);
  expect(new Set(plot.segments.map((segment) => segment.dash)).size).toBe(4);
  expect(plot.ticks.length).toBeGreaterThanOrEqual(6);
  for (const arrow of plot.segments.map((segment) => segment.arrow)) {
    const id = arrow.match(/url\(#(.+)\)/)[1];
    await expect(page.locator(`marker[id="${id}"]`)).toHaveAttribute('orient', 'auto');
  }
  await expect(page.locator('.simulation-plot')).toHaveAccessibleName(/围成的面积.*净功/);
  await setTemperature(page, 'hotK', 450);
  await setTemperature(page, 'coldK', 250);
  plot = await readCycle(page);
  expectPhysicalCycle(plot, 450, 250);
  await setTemperature(page, 'hotK', 500);
  expectPhysicalCycle(await readCycle(page), 500, 250);
});

test('equal Carnot temperatures show coincident states and no arrows on stationary adiabatic segments', async ({ page }) => {
  await setTemperature(page, 'hotK', 300);
  await expect(page.locator('[data-cycle-state]')).toHaveCount(4);
  const plot = await readCycle(page);
  expectPhysicalCycle(plot, 300, 300);
  expect(plot.states[0].x).toBe(plot.states[3].x);
  expect(plot.states[0].y).toBe(plot.states[3].y);
  expect(plot.states[1].x).toBe(plot.states[2].x);
  expect(plot.states[1].y).toBe(plot.states[2].y);
  expect(plot.segments.map((segment) => Boolean(segment.arrow))).toEqual([true, false, true, false]);
  await expect(page.locator('.simulation-plot')).toHaveAccessibleName(/重合.*净功为 0/);
  await expect(page.locator('[data-role="visual"]')).toContainText('净功为 0');
  await expect(page.locator('[data-role="result"]')).toContainText('W = 0 J');
  const labels = page.locator('[data-cycle-state-label]');
  await expect(labels).toHaveCount(4);
  expect(await labels.allTextContents()).toEqual(['1', '2', '3', '4']);
  const positions = await labels.evaluateAll((items) => items.map((item) => `${item.getAttribute('x')},${item.getAttribute('y')}`));
  expect(new Set(positions).size).toBe(4);
});

test('simulation labels and scientific strokes remain legible on a white reading surface', async ({ page }) => {
  const contrast = (color) => {
    const channels = color.match(/[\d.]+/g).slice(0, 3).map((value) => Number(value) / 255);
    const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 1.05 / (0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2] + 0.05);
  };
  for (const id of ['pendulum', 'wave', 'interference', 'maxwell', 'carnot', 'relativity', 'photoelectric', 'particles']) {
    const colors = await page.evaluate(async (simulationId) => {
      const { mountSimulation } = await import('/My-First-Git/assets/simulations.js');
      const host = document.createElement('div');
      document.body.append(host);
      const cleanup = mountSimulation(host, simulationId);
      const texts = [...host.querySelectorAll('svg text')].map((item) => {
        const channels = getComputedStyle(item).fill.match(/[\d.]+/g).map(Number);
        let opacity = channels[3] ?? 1;
        for (let ancestor = item; ancestor && ancestor !== host; ancestor = ancestor.parentElement) {
          opacity *= Number(getComputedStyle(ancestor).opacity);
        }
        return `rgb(${channels.slice(0, 3).map((channel) => channel * opacity + 255 * (1 - opacity)).join(', ')})`;
      });
      const strokes = [...host.querySelectorAll('svg [stroke]')].map((item) => getComputedStyle(item).stroke).filter((stroke) => stroke !== 'none');
      cleanup(); host.remove();
      return { texts, strokes };
    }, id);
    for (const color of colors.texts) expect(contrast(color), `${id} label ${color}`).toBeGreaterThanOrEqual(4.5);
    for (const color of colors.strokes) expect(contrast(color), `${id} stroke ${color}`).toBeGreaterThanOrEqual(3);
  }
});
