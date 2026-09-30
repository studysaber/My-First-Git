import { pendulumState, waveSample, maxwellDensity, carnotCycle, doubleSlitIntensity } from './physics-models.js';
import { createSimulationClock } from './simulation-clock.js';
export { pendulumState, waveSample, maxwellDensity, carnotCycle, doubleSlitIntensity } from './physics-models.js';

const UNIVERSAL_GAS_CONSTANT = 8.31446261815324;
const PLANCK_CONSTANT_EV_S = 4.135667696e-15;
const SPEED_OF_LIGHT_M_S = 299792458;
const MAX_NONRELATIVISTIC_RMS_SPEED_M_S = SPEED_OF_LIGHT_M_S * 0.1;

function finiteNumber(name, value) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} 必须是有限数值。`);
}

function positive(name, value) {
  finiteNumber(name, value);
  if (value <= 0) throw new RangeError(`${name} 必须大于 0。`);
}

export function pendulumPeriod({ length, gravity }) {
  positive('摆长', length);
  positive('重力加速度', gravity);
  const period = 2 * Math.PI * Math.sqrt(length / gravity);
  finiteNumber('周期结果', period);
  if (period <= 0) throw new RangeError('周期结果过小，无法用有限精度表示。');
  return period;
}

export function fringeSpacing({ wavelength, slitSeparation, screenDistance }) {
  positive('波长', wavelength);
  positive('双缝间距', slitSeparation);
  positive('屏距', screenDistance);
  const spacing = wavelength * screenDistance / slitSeparation;
  finiteNumber('条纹间距结果', spacing);
  if (spacing <= 0) throw new RangeError('条纹间距过小，无法用有限精度表示。');
  return spacing;
}

export function maxwellSpeeds({ temperature, molarMass }) {
  positive('绝对温度', temperature);
  positive('摩尔质量', molarMass);
  const criticalTemperature = (MAX_NONRELATIVISTIC_RMS_SPEED_M_S ** 2 / (3 * UNIVERSAL_GAS_CONSTANT)) * molarMass;
  if (temperature >= criticalTemperature) {
    throw new RangeError('经典麦克斯韦模型仅适用于方均根速率低于 0.1c 的非相对论范围。');
  }
  const scale = UNIVERSAL_GAS_CONSTANT * temperature / molarMass;
  const speeds = {
    mostProbable: Math.sqrt(2 * scale),
    mean: Math.sqrt(8 * scale / Math.PI),
    rms: Math.sqrt(3 * scale),
  };
  for (const [name, value] of Object.entries(speeds)) finiteNumber(`${name} 速率结果`, value);
  if (Object.values(speeds).some((value) => value <= 0)) throw new RangeError('速率结果过小，无法用有限精度表示。');
  if (speeds.rms >= MAX_NONRELATIVISTIC_RMS_SPEED_M_S) {
    throw new RangeError('经典麦克斯韦模型仅适用于方均根速率低于 0.1c 的非相对论范围。');
  }
  return speeds;
}

export function carnotEfficiency({ hotK, coldK }) {
  positive('高温热源温度', hotK);
  positive('低温热源温度', coldK);
  if (coldK > hotK) throw new RangeError('低温热源温度不能高于高温热源。');
  const efficiency = 1 - coldK / hotK;
  finiteNumber('效率结果', efficiency);
  if (hotK > coldK && (efficiency <= 0 || efficiency >= 1)) {
    throw new RangeError('效率结果超出当前数值精度可表示的范围。');
  }
  return efficiency;
}

export function relativityFactors(beta) {
  finiteNumber('速度比 β', beta);
  if (Math.abs(beta) >= 1) throw new RangeError('速度比必须满足 |β| < 1。');
  const lengthContractionFactor = Math.sqrt(1 - beta * beta);
  return { gamma: 1 / lengthContractionFactor, lengthContractionFactor };
}

export function photoelectricResult({ frequencyHz, workFunctionEv }) {
  positive('入射光频率', frequencyHz);
  positive('逸出功', workFunctionEv);
  const thresholdFrequencyHz = workFunctionEv / PLANCK_CONSTANT_EV_S;
  const photonEnergyEv = PLANCK_CONSTANT_EV_S * frequencyHz;
  finiteNumber('阈频结果', thresholdFrequencyHz);
  finiteNumber('光子能量结果', photonEnergyEv);
  const emitted = frequencyHz >= thresholdFrequencyHz;
  const maxKineticEnergyEv = emitted ? Math.max(0, photonEnergyEv - workFunctionEv) : null;
  const maxKineticEnergyJ = emitted ? maxKineticEnergyEv * 1.602176634e-19 : null;
  if (emitted) {
    finiteNumber('最大动能结果', maxKineticEnergyEv);
    finiteNumber('最大动能焦耳结果', maxKineticEnergyJ);
  }
  return {
    thresholdFrequencyHz,
    emitted,
    maxKineticEnergyEv,
    maxKineticEnergyJ,
    stoppingPotentialV: maxKineticEnergyEv,
  };
}

export const particleFamilies = Object.freeze({
  families: Object.freeze([
    Object.freeze({ id: 'quarks', name: '夸克', statistic: '费米子', members: Object.freeze(['上', '下', '粲', '奇', '顶', '底']) }),
    Object.freeze({ id: 'leptons', name: '轻子', statistic: '费米子', members: Object.freeze(['电子', 'μ子', 'τ子', '三种中微子']) }),
    Object.freeze({ id: 'gauge-bosons', name: '规范玻色子', statistic: '玻色子', members: Object.freeze(['光子', '胶子', 'W⁺/W⁻', 'Z⁰']) }),
    Object.freeze({ id: 'higgs', name: '希格斯粒子', statistic: '标量玻色子', members: Object.freeze(['希格斯玻色子']) }),
  ]),
  interactions: Object.freeze([
    Object.freeze({
      id: 'strong', name: '强相互作用', withinStandardModel: true,
      mediators: Object.freeze(['胶子（八种色荷组合）']),
      explanation: '标准模型内的规范相互作用；胶子携带色荷，受色禁闭影响，不会以自由粒子形式被观测。',
    }),
    Object.freeze({
      id: 'electromagnetic', name: '电磁相互作用', withinStandardModel: true,
      mediators: Object.freeze(['光子']),
      explanation: '标准模型内的规范相互作用；光子是无质量规范玻色子。',
    }),
    Object.freeze({
      id: 'weak', name: '弱相互作用', withinStandardModel: true,
      mediators: Object.freeze(['W⁺、W⁻、Z⁰']),
      explanation: '标准模型内的规范相互作用；W 与 Z 玻色子有质量，使弱作用程很短。',
    }),
    Object.freeze({
      id: 'gravity', name: '引力', withinStandardModel: false,
      mediators: Object.freeze([]),
      explanation: '引力在标准模型之外，目前由广义相对论描述；引力子只是量子引力框架中的假设粒子，尚未证实，不列为标准模型媒介粒子。',
    }),
  ]),
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function formatNumber(value, digits = 2) {
  finiteNumber('显示结果', value);
  if (value === 0) return '0';
  const magnitude = Math.abs(value);
  if (magnitude >= 1e6 || magnitude < 1e-3) {
    const [mantissa, exponent] = value.toExponential(digits).split('e');
    return `${mantissa} × 10^${Number(exponent)}`;
  }
  return value.toFixed(digits).replace(/\.?0+$/, '');
}

function range(name, label, min, max, step, value, unit) {
  return { name, label, type: 'range', min, max, step, value, unit, valueType: 'number' };
}

function choice(name, label, value, options, unit = '') {
  return { name, label, type: 'select', value, options, unit, valueType: 'string' };
}

const simulationDefinitions = {
  pendulum: {
    title: '小角单摆',
    controls: [range('length', '摆长 ℓ', 0.2, 2, 0.1, 1, 'm'), range('gravity', '重力加速度 g', 1, 20, 0.1, 9.8, 'm·s⁻²'), range('amplitudeDeg', '振幅角 θ₀', 1, 10, 1, 10, '°')],
    calculate: (values) => ({ ...values, period: pendulumPeriod(values) }),
    summary: ({ period, length, gravity, amplitudeDeg }, time) => `周期 T = ${formatNumber(period)} s；t = ${formatNumber(time, 2)} s；θ₀ = ${formatNumber(amplitudeDeg)}°；ℓ = ${formatNumber(length)} m，g = ${formatNumber(gravity)} m·s⁻²。适用条件：小角谐振近似，摆线质量忽略。`,
    fallback: '摆球沿圆弧往复运动；小角度下重力切向分量近似正比于位移，因此周期主要由摆长和重力加速度决定。',
  },
  wave: {
    title: '行波与驻波',
    controls: [
      choice('mode', '波型', 'travelling', [{ value: 'travelling', label: '行波' }, { value: 'standing', label: '驻波' }]),
      range('amplitude', '入射波振幅 A', 0.001, 0.005, 0.001, 0.003, 'm'),
      range('wavelength', '波长 λ', 0.5, 3, 0.1, 1.6, 'm'),
      range('period', '周期 T', 0.5, 4, 0.1, 2, 's'),
    ],
    calculate: (values) => {
      return { ...values, sample: waveSample({ ...values, x: 0.37, time: 0.42 }) };
    },
    summary: ({ mode, sample, amplitude, wavelength, period }, time) => `${mode === 'standing' ? '驻波' : '行波'}；A = ${formatNumber(amplitude * 1000)} mm，λ = ${formatNumber(wavelength)} m，T = ${formatNumber(period)} s，u = ${formatNumber(wavelength / period)} m/s；t = ${formatNumber(time)} s。驻波波腹为 2A。适用条件：线性小振幅波；图中纵横比例不同。`,
    fallback: '行波把振动状态沿空间传播；驻波的节点固定不动，腹点振幅最大。图线按当前波型绘制，空间和时间坐标均以 m、s 标记。',
  },
  interference: {
    title: '双缝干涉',
    controls: [
      range('wavelengthNm', '真空波长 λ', 380, 700, 10, 500, 'nm'),
      range('slitSeparationMm', '双缝间距 d', 0.1, 0.5, 0.01, 0.25, 'mm'),
      range('screenDistance', '屏距 L', 0.5, 2, 0.1, 1, 'm'),
    ],
    calculate: (values) => ({
      ...values,
      spacing: fringeSpacing({ wavelength: values.wavelengthNm * 1e-9, slitSeparation: values.slitSeparationMm * 1e-3, screenDistance: values.screenDistance }),
    }),
    summary: ({ spacing, wavelengthNm, slitSeparationMm, screenDistance }) => `相邻亮纹间距 Δy = ${formatNumber(spacing * 1e3)} mm（λ = ${formatNumber(wavelengthNm)} nm，d = ${formatNumber(slitSeparationMm)} mm，L = ${formatNumber(screenDistance)} m）。适用条件：远屏小角近似，观察区域远小于屏距。`,
    fallback: '两条相干光路的光程差决定明暗条纹；增加波长或屏距会拉大条纹，增加双缝间距会缩小条纹。',
  },
  maxwell: {
    title: '麦克斯韦速率分布',
    controls: [
      range('temperature', '气体温度 T', 150, 900, 10, 300, 'K'),
      { ...choice('molarMass', '气体摩尔质量 M', '0.028', [
        { value: '0.002', label: '氢气 H₂ · 0.002 kg·mol⁻¹' },
        { value: '0.028', label: '氮气 N₂ · 0.028 kg·mol⁻¹' },
        { value: '0.040', label: '氩气 Ar · 0.040 kg·mol⁻¹' },
        { value: '0.044', label: '二氧化碳 CO₂ · 0.044 kg·mol⁻¹' },
      ]), valueType: 'number' },
    ],
    calculate: (values) => ({ ...values, speeds: maxwellSpeeds(values) }),
    summary: ({ temperature, molarMass, speeds }) => `最概然速率 ${formatNumber(speeds.mostProbable)} m/s；平均速率 ${formatNumber(speeds.mean)} m/s；方均根速率 ${formatNumber(speeds.rms)} m/s。T = ${formatNumber(temperature)} K，M = ${formatNumber(molarMass, 3)} kg·mol⁻¹。适用条件：稀薄经典理想气体处于热平衡，且非相对论近似要求 v_rms < 0.1c（保守界限）。`,
    fallback: '分子速率不是单一值，而是一个分布；升温使分布展宽并移向高速侧，较重分子在相同温度下整体较慢。',
  },
  carnot: {
    title: '卡诺热机',
    controls: [range('hotK', '高温热源 Tₕ', 250, 900, 10, 600, 'K'), range('coldK', '低温热源 T꜀', 150, 650, 10, 300, 'K')],
    calculate: (values) => ({ ...values, cycle: carnotCycle(values) }),
    summary: ({ hotK, coldK, cycle }) => `W = ${formatNumber(cycle.work)} J；Qₕ = ${formatNumber(cycle.heatIn)} J；η = ${formatNumber(cycle.efficiency * 100, 1)}%；Tₕ = ${formatNumber(hotK)} K，T꜀ = ${formatNumber(coldK)} K。适用条件：1 mol、γ=1.4 定热容理想气体的可逆卡诺循环。`,
    fallback: '循环经过两条等温线和两条绝热线；温差越小，理论效率越低。真实热机不可逆，效率低于卡诺上限。',
  },
  relativity: {
    title: '时间延缓与长度收缩',
    controls: [range('beta', '速度比 β = v/c', 0, 0.99, 0.01, 0.8, '无量纲')],
    calculate: (values) => ({ ...values, ...relativityFactors(values.beta) }),
    summary: ({ beta, gamma, lengthContractionFactor }) => `γ = ${formatNumber(gamma, 3)}；τ/t = ${formatNumber(1 / gamma, 3)}；L/L₀ = ${formatNumber(lengthContractionFactor, 3)}。β = ${formatNumber(beta, 2)}；实验室系中 t 与运动钟固有时 τ 对比；长度须在实验室系同时测量。适用条件：惯性参考系，且 |β| < 1。`,
    fallback: '沿运动方向测得的长度收缩，运动时钟相对实验室时间变慢；两者由同一个洛伦兹因子 γ 联系。',
  },
  photoelectric: {
    title: '光电效应阈频',
    controls: [
      range('frequencyScale', '入射频率 ν', 2.5, 8, 0.1, 5, '×10¹⁴ Hz'),
      range('workFunctionEv', '金属逸出功 Φ', 1, 4, 0.1, 2, 'eV'),
    ],
    calculate: (values) => ({ ...values, ...photoelectricResult({ frequencyHz: values.frequencyScale * 1e14, workFunctionEv: values.workFunctionEv }) }),
    summary: ({ thresholdFrequencyHz, emitted, maxKineticEnergyEv, stoppingPotentialV }) => `阈频 ν₀ = ${formatNumber(thresholdFrequencyHz)} Hz；${emitted ? `有光电子逸出，Kₘₐₓ = ${formatNumber(maxKineticEnergyEv)} eV，遏止电压 V₀ = ${formatNumber(stoppingPotentialV)} V` : '频率低于阈值，无光电子逸出；Kₘₐₓ 与遏止电压不适用'}。适用条件：单光子能量 hν；表面逸出功固定。`,
    fallback: '频率决定单个光子的能量；超过阈频后，增加频率会提高光电子最大动能，单纯增大光强不会改变阈频。',
  },
  particles: {
    title: '粒子族与相互作用媒介',
    controls: [choice('interaction', '查看相互作用', 'strong', particleFamilies.interactions.map(({ id, name }) => ({ value: id, label: name })))],
    calculate: ({ interaction }) => {
      const selected = particleFamilies.interactions.find((item) => item.id === interaction);
      if (!selected) throw new RangeError('请选择表中的一种相互作用。');
      return { selected };
    },
    summary: ({ selected }) => `${selected.name}：${selected.mediators.length ? `媒介粒子为${selected.mediators.join('、')}。` : '标准模型没有确认的媒介粒子。'}${selected.explanation} 分类概念无连续数值单位；自旋以 ℏ 为单位、电荷以 e 为单位。`,
    fallback: '标准模型把基本物质粒子分为夸克和轻子，并描述强、电磁、弱相互作用；引力在标准模型之外。',
  },
};

function parameterMarkup(parameter) {
  const name = escapeHtml(parameter.name);
  const label = escapeHtml(parameter.label);
  const unit = escapeHtml(parameter.unit ?? '');
  const shownValue = parameter.type === 'select'
    ? parameter.options.find((option) => String(option.value) === String(parameter.value))?.label ?? parameter.value
    : `${formatNumber(Number(parameter.value), 2)} ${unit}`.trim();
  const output = `<output class="simulation-control-value" data-value-for="${name}">${escapeHtml(shownValue)}</output>`;
  if (parameter.type === 'select') {
    const options = parameter.options.map((option) => `<option value="${escapeHtml(option.value)}"${String(option.value) === String(parameter.value) ? ' selected' : ''}>${escapeHtml(option.label)}</option>`).join('');
    return `<label class="simulation-control"><span>${label} ${output}</span><select data-param="${name}" data-value-type="${parameter.valueType}" aria-label="${label}">${options}</select>${unit ? `<small>${unit}</small>` : ''}</label>`;
  }
  return `<label class="simulation-control"><span>${label} ${output}</span><input type="range" data-param="${name}" data-value-type="number" min="${parameter.min}" max="${parameter.max}" step="${parameter.step}" value="${parameter.value}" aria-label="${label}，${unit}"><small>${unit}</small></label>`;
}

function wavePathData(state, time) {
  const path = [];
  for (let index = 0; index <= 120; index += 1) {
    const x = index * 0.05;
    const displacement = waveSample({ x, time, amplitude: state.amplitude, wavelength: state.wavelength, period: state.period, mode: state.mode });
    const px = 20 + index * 2;
    const py = 75 - displacement / 0.011 * 52;
    path.push(`${index === 0 ? 'M' : 'L'}${px.toFixed(2)} ${py.toFixed(2)}`);
  }
  return path.join(' ');
}

function plotGeometry(id, state, waveTime = 0) {
  if (id === 'pendulum') {
    const bob = pendulumState({ length: state.length, gravity: state.gravity, amplitudeRad: state.amplitudeDeg * Math.PI / 180, time: waveTime });
    const bobX = 140 + bob.x * 50, bobY = 18 + bob.y * 50;
    return `<svg class="simulation-plot" viewBox="0 0 280 150" role="img" aria-label="小角单摆，悬点固定，摆长比例为每米50像素"><circle cx="140" cy="18" r="4" fill="var(--plot-ochre, #8A5A12)"/><line x1="140" y1="18" x2="${bobX.toFixed(2)}" y2="${bobY.toFixed(2)}" stroke="var(--plot-blue, #275F91)" stroke-width="2"/><circle data-pendulum-bob="true" cx="${bobX.toFixed(2)}" cy="${bobY.toFixed(2)}" r="9" fill="var(--plot-green, #24664F)"/><text x="16" y="136">ℓ = ${formatNumber(state.length)} m；t = ${formatNumber(waveTime)} s</text><text x="18" y="22">小角近似</text></svg>`;
  }
  if (id === 'wave') {
    const timeNote = state.mode === 'standing' ? '驻波随时间振荡，节点固定' : '行波形状随时间沿 +x 方向传播';
    return `<svg class="simulation-plot" viewBox="0 0 280 150" role="img" aria-label="${state.mode === 'standing' ? '驻波' : '行波'}位移曲线，${timeNote}；x：0—6 m，y：−11—11 mm"><path d="M20 75H260 M20 20V130" stroke="var(--plot-axis, #637067)"/><path data-wave-path="true" d="${wavePathData(state, waveTime)}" fill="none" stroke="var(--plot-green, #24664F)" stroke-width="2"/><text x="220" y="139">6 m</text><text x="22" y="18">11 mm</text><text x="22" y="135">−11 mm</text><text x="200" y="18">x：0—6 m</text><text x="185" y="32">y：−11—11 mm</text></svg>`;
  }
  if (id === 'interference') {
    const physical = { wavelength: state.wavelengthNm * 1e-9, slitSeparation: state.slitSeparationMm * 1e-3, screenDistance: state.screenDistance };
    const bands = Array.from({ length: 1201 }, (_, index) => {
      const y = (index - 600) * 0.00005;
      const intensity = doubleSlitIntensity({ ...physical, y });
      return `<line x1="215" y1="${(20 + index * 0.09).toFixed(2)}" x2="245" y2="${(20 + index * 0.09).toFixed(2)}" stroke="var(--plot-green, #24664F)" stroke-width="0.09" opacity="${intensity.toFixed(3)}"/>`;
    }).join('');
    return `<svg class="simulation-plot" viewBox="0 0 280 150" role="img" aria-label="理想等强窄双缝；观察屏 y：−30—30 mm，无单缝衍射包络"><path d="M52 20V72 M52 78V130" stroke="var(--plot-blue, #275F91)" stroke-width="5"/><rect data-slit="left" x="48" y="72" width="8" height="2" fill="var(--plot-green, #24664F)"/><rect data-slit="right" x="48" y="76" width="8" height="2" fill="var(--plot-green, #24664F)"/><path d="M205 18V132" stroke="var(--plot-axis, #637067)" stroke-width="3"/>${bands}<text x="16" y="143">双缝 d=${formatNumber(state.slitSeparationMm)} mm</text><text x="184" y="143">屏 −30—30 mm</text></svg>`;
  }
  if (id === 'maxwell') {
    const line = (temperature) => Array.from({ length: 101 }, (_, index) => {
      const speed = index * 50;
      const density = maxwellDensity({ speed, temperature, molarMass: state.molarMass });
      return `${index ? 'L' : 'M'}${(24 + index * 2.32).toFixed(2)} ${(122 - density / 0.004 * 100).toFixed(2)}`;
    }).join(' ');
    const tailStep = 50, tailEnd = state.speeds.rms * 8;
    let tail = 0;
    for (let v = 5000; v < tailEnd; v += tailStep) tail += (maxwellDensity({ speed: v, temperature: state.temperature, molarMass: state.molarMass }) + maxwellDensity({ speed: v + tailStep, temperature: state.temperature, molarMass: state.molarMass })) * tailStep / 2;
    return `<svg class="simulation-plot" viewBox="0 0 280 150" role="img" aria-label="麦克斯韦速率分布，固定 x：0—5000 m/s，y：0—0.004 s/m；虚线为300 K参考，实线为当前温度；窗口外概率约 ${formatNumber(tail * 100, 2)}%"><path d="M24 122H256 M24 122V22" stroke="var(--plot-axis, #637067)"/><path d="${line(300)}" fill="none" stroke="var(--plot-blue, #275F91)" stroke-width="2" stroke-dasharray="5 3"/><path d="${line(state.temperature)}" fill="none" stroke="var(--plot-green, #24664F)" stroke-width="2"/><text x="205" y="139">5000 m/s</text><text x="20" y="19">0.004 s/m</text><text x="26" y="137">0</text><text x="130" y="19">虚线：300 K 参考</text><text x="130" y="33">实线：${formatNumber(state.temperature)} K</text><text x="90" y="139">窗口外 ${formatNumber(tail * 100, 2)}%</text></svg>`;
  }
  if (id === 'carnot') {
    const points = state.cycle.segments.flatMap((segment) => segment.points);
    const maxV = Math.max(...points.map((point) => point.volume)) * 1.05;
    const maxP = Math.max(...points.map((point) => point.pressure)) * 1.1;
    const x = (volume) => 50 + volume / maxV * 270;
    const y = (pressure) => 190 - pressure / maxP * 160;
    const pathData = (curve) => curve.map((point, i) => `${i ? 'L' : 'M'}${x(point.volume).toFixed(2)} ${y(point.pressure).toFixed(2)}`).join(' ');
    const roles = ['var(--plot-green, #24664F)', 'var(--plot-blue, #275F91)', 'var(--plot-ochre, #8A5A12)', 'var(--plot-purple, #71539A)'];
    const dashes = ['', '7 3', '2 3', '7 3 2 3'];
    const collapsed = state.hotK === state.coldK;
    const explanation = collapsed
      ? '两热源等温：状态 1 与 4、2 与 3 重合；等温线往返重合，绝热段无变化，围成的面积为 0，净功为 0。'
      : '按 1→2→3→4→1 完成顺时针循环；p-V 图围成的面积等于每循环气体对外的净功 W = ∮p dV。';
    const definitions = roles.map((color, index) => `<marker id="carnot-arrow-${index}" viewBox="0 0 10 10" refX="12" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="${color}"/></marker>`).join('');
    const segments = state.cycle.segments.map((segment, index) => {
      const moving = !collapsed || index % 2 === 0;
      return `<path data-cycle-segment="${index}" d="${pathData(segment.points)}" fill="none" stroke="${roles[index]}" stroke-width="2" stroke-dasharray="${dashes[index]}"${moving ? ` marker-end="url(#carnot-arrow-${index})"` : ''}><title>${index + 1}→${(index + 1) % 4 + 1}：${segment.name}${moving ? '' : '（无变化）'}</title></path>`;
    }).join('');
    // Labels move away from the actual vertices; coincident states retain identical coordinates.
    const offsets = [[-9, -10], [9, -8], [9, 18], [-9, 18]];
    const vertices = state.cycle.segments.map((segment, index) => {
      const point = segment.points[0];
      return `<circle data-cycle-state="${index + 1}" cx="${x(point.volume).toFixed(2)}" cy="${y(point.pressure).toFixed(2)}" r="3" fill="var(--plot-ink, #303D35)"/><text data-cycle-state-label="${index + 1}" x="${(x(point.volume) + offsets[index][0]).toFixed(2)}" y="${(y(point.pressure) + offsets[index][1]).toFixed(2)}" text-anchor="${index === 1 || index === 2 ? 'start' : 'end'}">${index + 1}</text>`;
    }).join('');
    const ticks = [0.25, 0.5, 0.75].map((fraction) => `<path d="M${x(fraction * maxV)} 190v4 M46 ${y(fraction * maxP)}h4" stroke="var(--plot-axis, #637067)"/><text data-cycle-tick="volume" x="${x(fraction * maxV)}" y="205" text-anchor="middle">${formatNumber(fraction * maxV, 1)}</text><text data-cycle-tick="pressure" x="43" y="${y(fraction * maxP) + 3}" text-anchor="end">${formatNumber(fraction * maxP, 1)}</text>`).join('');
    const legend = state.cycle.segments.map((segment, index) => {
      const lx = index % 2 ? 190 : 18, ly = 242 + Math.floor(index / 2) * 23;
      return `<path d="M${lx} ${ly - 4}h22" stroke="${roles[index]}" stroke-width="2" stroke-dasharray="${dashes[index]}"/><text x="${lx + 28}" y="${ly}">${index + 1}→${(index + 1) % 4 + 1} ${segment.name}${collapsed && index % 2 ? '（无变化）' : ''}</text>`;
    }).join('');
    return `<svg class="simulation-plot" viewBox="0 0 360 296" role="img" aria-label="卡诺循环 p-V 图。${explanation} 四段线型分别为实线、长虚线、点线、点划线。"><defs>${definitions}</defs><path d="M50 190H325 M50 190V25" stroke="var(--plot-axis, #637067)"/>${ticks}${segments}${vertices}<text x="50" y="16">p：0—${formatNumber(maxP)} Pa</text><text x="180" y="220">V：0—${formatNumber(maxV)} m³</text><text x="43" y="205">0</text>${legend}<text x="18" y="287">${collapsed ? '等温线重合；围成面积 = 净功 = 0' : '围成面积 = 每循环净功 W = ∮p dV'}</text></svg>`;
  }
  if (id === 'relativity') {
    const width = 110 * state.lengthContractionFactor;
    return `<svg class="simulation-plot" viewBox="0 0 280 150" role="img" aria-label="实验室系的时钟与长度比较"><text x="17" y="28">实验室时钟 t：1 s</text><rect x="145" y="17" width="110" height="12" fill="var(--plot-blue, #275F91)"/><text x="17" y="55">运动钟 τ：${formatNumber(1 / state.gamma, 2)} s</text><rect x="145" y="44" width="${width.toFixed(2)}" height="12" fill="var(--plot-green, #24664F)"/><text x="17" y="89">静止长 L₀：1 m</text><rect x="145" y="78" width="110" height="12" fill="var(--plot-blue, #275F91)"/><text x="17" y="116">运动长 L：${formatNumber(state.lengthContractionFactor, 2)} m</text><rect x="145" y="105" width="${width.toFixed(2)}" height="12" fill="var(--plot-green, #24664F)"/><text x="19" y="140">长度端点须在实验室系同时测量</text></svg>`;
  }
  if (id === 'photoelectric') {
    const work = Number(state.workFunctionEv ?? 2);
    const frequency = Number(state.frequencyScale ?? 5);
    const energy = PLANCK_CONSTANT_EV_S * frequency * 1e14;
    const threshold = work / PLANCK_CONSTANT_EV_S / 1e14;
    const x = (frequencyValue) => 38 + (frequencyValue - 2.5) / 5.5 * 215;
    const y = (kinetic) => 113 - kinetic / 2.4 * 76;
    const curveStart = Math.max(2.5, threshold);
    const line = threshold <= 8 ? Array.from({ length: 41 }, (_, index) => {
      const f = curveStart + (8 - curveStart) * index / 40;
      return `${index ? 'L' : 'M'}${x(f).toFixed(2)} ${y(Math.max(0, PLANCK_CONSTANT_EV_S * f * 1e14 - work)).toFixed(2)}`;
    }).join(' ') : '';
    const marker = state.emitted
      ? `<circle cx="${x(frequency).toFixed(2)}" cy="${y(state.maxKineticEnergyEv).toFixed(2)}" r="4" fill="var(--plot-ochre, #8A5A12)"/>`
      : `<path d="M${x(frequency).toFixed(2)} 113V46" stroke="var(--plot-ochre, #8A5A12)" stroke-dasharray="3 4"/><text x="105" y="29">hν &lt; Φ：无逸出</text>`;
    return `<svg class="simulation-plot" viewBox="0 0 280 150" role="img" aria-label="光电效应最大动能与频率曲线；入射光指向金属，阈频以下无逸出"><path d="M15 40L52 40" stroke="var(--plot-purple, #71539A)" stroke-width="3"/><path d="M52 30V50" stroke="var(--plot-blue, #275F91)" stroke-width="5"/><text x="14" y="23">光 → 金属</text><path d="M38 113H258 M38 113V33" stroke="var(--plot-axis, #637067)"/>${line ? `<path d="${line}" fill="none" stroke="var(--plot-green, #24664F)" stroke-width="2"/>` : ''}${marker}${state.emitted ? '<text x="146" y="29">hν = Φ + Kₘₐₓ</text>' : ''}<text x="200" y="139">ν (×10¹⁴ Hz)</text><text x="42" y="130">Kₘₐₓ (eV)</text></svg>`;
  }
  const rows = particleFamilies.interactions.map((interaction, index) => {
    const y = 30 + index * 27;
    const active = interaction.id === state.selected.id;
    return `<g><rect x="20" y="${y}" width="240" height="21" rx="5" fill="${active ? 'var(--plot-selection, #E8F1EC)' : 'var(--plot-surface, #FFFFFF)'}" stroke="${active ? 'var(--plot-green, #24664F)' : 'var(--plot-axis, #637067)'}" stroke-width="${active ? '2' : '1'}"/><text x="30" y="${y + 15}"${active ? ' font-weight="700"' : ''}>${escapeHtml(interaction.name)}</text><text x="125" y="${y + 15}">${escapeHtml(interaction.mediators.join('、') || '标准模型之外')}</text></g>`;
  }).join('');
  return `<svg class="simulation-plot" viewBox="0 0 280 150" role="img" aria-label="四种基本相互作用和媒介粒子列表">${rows}<text x="22" y="145">物质粒子：夸克 · 轻子</text></svg>`;
}

function plotSvg(id, state, waveTime = 0) {
  // An explicit text role stays readable even while the surrounding stylesheet is being migrated.
  return plotGeometry(id, state, waveTime).replaceAll('<text ', '<text style="fill:var(--plot-ink, #303D35)" ');
}

function visualMarkup(id, state, definition, waveTime = 0) {
  const areaNote = id === 'carnot' ? (state.hotK === state.coldK
    ? '两热源等温时，状态 1 与 4、2 与 3 重合，绝热段无变化；等温线往返重合，围成面积与净功为 0。'
    : 'p-V 图中，顺时针循环围成的面积等于每循环气体对外做的净功 W = ∮p dV。') : '';
  return `${plotSvg(id, state, waveTime)}<p class="simulation-fallback">${escapeHtml(definition.fallback)}${areaNote}</p>`;
}

function initialValues(definition) {
  return Object.fromEntries(definition.controls.map((control) => [control.name, control.valueType === 'number' ? Number(control.value) : control.value]));
}

export function mountSimulation(container, id) {
  const definition = simulationDefinitions[id];
  if (!definition || !container) throw new RangeError('未找到对应的物理演示容器。');

  const defaults = initialValues(definition);
  const firstState = definition.calculate(defaults);
  const controlsMarkup = definition.controls.map((parameter) => id === 'pendulum' && parameter.name === 'amplitudeDeg'
    ? `<details class="simulation-extra"><summary>振幅角设置</summary>${parameterMarkup(parameter)}</details>`
    : parameterMarkup(parameter)).join('');
  const dynamic = id === 'wave' || id === 'pendulum';
  container.innerHTML = `
    <section class="simulation-card" aria-labelledby="simulation-title-${escapeHtml(id)}">
      <div class="simulation-heading"><h3 id="simulation-title-${escapeHtml(id)}">${id === 'pendulum' ? '改变摆长，观察周期' : escapeHtml(definition.title)}</h3></div>
      <div class="simulation-model">
      <div class="simulation-visual" data-role="visual">${visualMarkup(id, firstState, definition)}</div>
      <div class="simulation-playback">${dynamic ? '<button class="simulation-pause" type="button" data-action="pause" aria-pressed="false">暂停演示</button><button type="button" data-action="step">单步 +0.1 s</button>' : ''}</div>
      </div>
      <div class="simulation-settings">
      <div class="simulation-controls">${controlsMarkup}</div>
      ${id === 'pendulum' ? '<p class="period-readout">周期 <i>T</i><output data-role="period"></output><small>小角度近似 · 忽略阻力</small></p>' : ''}
      <p class="simulation-result" data-role="result" aria-live="polite"></p>
      </div>
      <p class="simulation-validation" data-role="validation" role="status"></p>
    </section>`;

  const controls = [...container.querySelectorAll('[data-param]')];
  const result = container.querySelector('[data-role="result"]');
  const validation = container.querySelector('[data-role="validation"]');
  const visual = container.querySelector('[data-role="visual"]');
  const pause = container.querySelector('[data-action="pause"]');
  if (!result || !validation || !visual || (dynamic && !pause)) throw new Error('演示界面缺少必要的结果或控制区域。');

  const readValues = () => Object.fromEntries(controls.map((control) => {
    const name = control.dataset.param;
    const parameter = definition.controls.find((item) => item.name === name);
    const raw = control.value;
    if (parameter.valueType !== 'number') return [name, raw];
    const value = Number(raw);
    finiteNumber(parameter.label, value);
    return [name, value];
  }));

  let currentState = null;
  let cleaned = false;
  let isPaused = false;
  const motionQuery = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-reduced-motion: reduce)') : null;
  let systemReducedMotion = Boolean(motionQuery?.matches);
  if (systemReducedMotion) container.classList.add('reduced-motion');

  const appReducedMotion = () => Boolean(container.closest?.('.reduced-motion'));
  const clock = createSimulationClock({ onFrame: (time) => {
    if (!currentState) return;
    visual.innerHTML = visualMarkup(id, currentState, definition, time);
    result.textContent = definition.summary(currentState, time);
  } });
  const mayAnimate = () => dynamic
    && currentState !== null
    && !cleaned
    && !isPaused
    && !systemReducedMotion
    && !appReducedMotion();
  const syncWaveAnimation = () => {
    if (mayAnimate()) clock.play();
    else clock.pause();
  };

  const motionObserver = typeof MutationObserver === 'function' ? new MutationObserver(syncWaveAnimation) : null;
  if (motionObserver) {
    for (let ancestor = container; ancestor; ancestor = ancestor.parentElement) {
      motionObserver.observe(ancestor, { attributes: true, attributeFilter: ['class'] });
    }
  }
  const onSystemMotionChange = (event) => {
    systemReducedMotion = Boolean(event.matches);
    container.classList.toggle('reduced-motion', systemReducedMotion);
    syncWaveAnimation();
  };
  let removeMotionListener = null;
  if (motionQuery?.addEventListener) {
    motionQuery.addEventListener('change', onSystemMotionChange);
    removeMotionListener = () => motionQuery.removeEventListener?.('change', onSystemMotionChange);
  } else if (motionQuery?.addListener) {
    motionQuery.addListener(onSystemMotionChange);
    removeMotionListener = () => motionQuery.removeListener?.(onSystemMotionChange);
  }

  const updateControlOutputs = () => {
    for (const control of controls) {
      const name = control.dataset.param;
      const parameter = definition.controls.find((item) => item.name === name);
      const output = container.querySelector(`[data-value-for="${name}"]`);
      if (!output) continue;
      if (parameter.type === 'select') {
        output.textContent = parameter.options.find((option) => String(option.value) === String(control.value))?.label ?? control.value;
      } else {
        const value = Number(control.value);
        output.textContent = `${formatNumber(value, 2)} ${parameter.unit}`.trim();
      }
    }
  };

  let initialized = false;
  const update = () => {
    try {
      const state = definition.calculate(readValues());
      if (dynamic) clock.reset();
      result.textContent = definition.summary(state, clock.time);
      validation.textContent = initialized && dynamic ? '参数已更新，模拟时间重置为 0 s。' : '';
      currentState = state;
      const periodReadout = container.querySelector('[data-role="period"]');
      if (periodReadout) periodReadout.textContent = `${state.period.toFixed(2)} s`;
      visual.innerHTML = visualMarkup(id, state, definition, clock.time);
      syncWaveAnimation();
    } catch (error) {
      currentState = null;
      syncWaveAnimation();
      result.textContent = '暂不显示计算结果；请先修正参数。';
      validation.textContent = error instanceof RangeError ? error.message : '参数无效，请检查输入范围。';
      visual.innerHTML = `<p class="simulation-fallback">${escapeHtml(definition.fallback)}</p>`;
    }
    updateControlOutputs();
    initialized = true;
  };

  for (const control of controls) {
    control.addEventListener('input', update);
    control.addEventListener('change', update);
  }
  const togglePause = () => {
    isPaused = pause.getAttribute('aria-pressed') !== 'true';
    pause.setAttribute('aria-pressed', String(isPaused));
    pause.textContent = isPaused ? '继续演示' : '暂停演示';
    container.classList.toggle('simulation-paused', isPaused);
    syncWaveAnimation();
  };
  pause?.addEventListener('click', togglePause);
  const onVisibilityChange = () => {
    if (!globalThis.document?.hidden || !pause || !dynamic) return;
    isPaused = true;
    pause.setAttribute('aria-pressed', 'true');
    pause.textContent = '继续演示';
    container.classList.add('simulation-paused');
    syncWaveAnimation();
  };
  globalThis.document?.addEventListener?.('visibilitychange', onVisibilityChange);
  const step = container.querySelector('[data-action="step"]');
  const stepForward = () => { if (!clock.playing) clock.step(0.1); };
  step?.addEventListener('click', stepForward);

  update();

  return () => {
    for (const control of controls) {
      control.removeEventListener?.('input', update);
      control.removeEventListener?.('change', update);
    }
    pause?.removeEventListener?.('click', togglePause);
    globalThis.document?.removeEventListener?.('visibilitychange', onVisibilityChange);
    step?.removeEventListener?.('click', stepForward);
    cleaned = true;
    clock.destroy();
    motionObserver?.disconnect();
    removeMotionListener?.();
    container.classList.remove('simulation-paused');
    if (systemReducedMotion) container.classList.remove('reduced-motion');
    container.innerHTML = '';
  };
}
