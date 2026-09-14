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

export function waveSample({ x, time, amplitude, wavelength, period, mode }) {
  finiteNumber('位置', x);
  finiteNumber('时间', time);
  finiteNumber('振幅', amplitude);
  if (amplitude < 0) throw new RangeError('振幅不能为负数。');
  positive('波长', wavelength);
  positive('周期', period);
  if (!['travelling', 'traveling', 'standing'].includes(mode)) throw new RangeError('波型必须是行波或驻波。');

  const phaseInSpace = 2 * Math.PI * x / wavelength;
  const phaseInTime = 2 * Math.PI * time / period;
  const displacement = mode === 'standing'
    ? amplitude * Math.sin(phaseInSpace) * Math.cos(phaseInTime)
    : amplitude * Math.cos(phaseInSpace - phaseInTime);
  finiteNumber('位移结果', displacement);
  return displacement;
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
  const maxKineticEnergyEv = Math.max(0, PLANCK_CONSTANT_EV_S * frequencyHz - workFunctionEv);
  finiteNumber('阈频结果', thresholdFrequencyHz);
  finiteNumber('最大动能结果', maxKineticEnergyEv);
  return {
    thresholdFrequencyHz,
    emitted: frequencyHz >= thresholdFrequencyHz,
    maxKineticEnergyEv,
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
    controls: [range('length', '摆长 ℓ', 0.2, 2, 0.1, 1, 'm'), range('gravity', '重力加速度 g', 1, 20, 0.1, 9.8, 'm·s⁻²')],
    calculate: (values) => ({ ...values, period: pendulumPeriod(values) }),
    summary: ({ period, length, gravity }) => `周期 T = ${formatNumber(period)} s；ℓ = ${formatNumber(length)} m，g = ${formatNumber(gravity)} m·s⁻²。适用条件：摆角较小（θ₀ ≪ 1 rad），摆线质量忽略。`,
    fallback: '摆球沿圆弧往复运动；小角度下重力切向分量近似正比于位移，因此周期主要由摆长和重力加速度决定。',
  },
  wave: {
    title: '行波与驻波',
    controls: [
      choice('mode', '波型', 'travelling', [{ value: 'travelling', label: '行波' }, { value: 'standing', label: '驻波' }]),
      range('amplitude', '振幅 A', 0.2, 1.5, 0.1, 0.8, 'm'),
      range('wavelength', '波长 λ', 0.5, 3, 0.1, 1.6, 'm'),
    ],
    calculate: (values) => {
      const period = 2;
      return { ...values, period, sample: waveSample({ ...values, period, x: 0.37, time: 0.42 }) };
    },
    summary: ({ mode, sample, amplitude, wavelength, period }) => `${mode === 'standing' ? '驻波' : '行波'}在示例位置的位移 y = ${formatNumber(sample)} m；A = ${formatNumber(amplitude)} m，λ = ${formatNumber(wavelength)} m，T = ${formatNumber(period)} s。适用条件：线性小振幅波；驻波由反向同频波叠加形成。`,
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
    calculate: (values) => ({ ...values, efficiency: carnotEfficiency(values) }),
    summary: ({ hotK, coldK, efficiency }) => `可逆热机效率上限 η = ${formatNumber(efficiency * 100, 1)}%；Tₕ = ${formatNumber(hotK)} K，T꜀ = ${formatNumber(coldK)} K。适用条件：可逆卡诺循环且 0 < T꜀ ≤ Tₕ；效率不可能超过 100%。`,
    fallback: '循环经过两条等温线和两条绝热线；温差越小，理论效率越低。真实热机不可逆，效率低于卡诺上限。',
  },
  relativity: {
    title: '时间延缓与长度收缩',
    controls: [range('beta', '速度比 β = v/c', 0, 0.99, 0.01, 0.8, '无量纲')],
    calculate: (values) => ({ ...values, ...relativityFactors(values.beta) }),
    summary: ({ beta, gamma, lengthContractionFactor }) => `γ = ${formatNumber(gamma, 3)}（无量纲）；L/L₀ = ${formatNumber(lengthContractionFactor, 3)}（无量纲）。β = ${formatNumber(beta, 2)}；适用条件：惯性参考系，且 |β| < 1。`,
    fallback: '沿运动方向测得的长度收缩，运动时钟相对实验室时间变慢；两者由同一个洛伦兹因子 γ 联系。',
  },
  photoelectric: {
    title: '光电效应阈频',
    controls: [
      range('frequencyScale', '入射频率 ν', 2.5, 8, 0.1, 5, '×10¹⁴ Hz'),
      range('workFunctionEv', '金属逸出功 Φ', 1, 4, 0.1, 2, 'eV'),
    ],
    calculate: (values) => photoelectricResult({ frequencyHz: values.frequencyScale * 1e14, workFunctionEv: values.workFunctionEv }),
    summary: ({ thresholdFrequencyHz, emitted, maxKineticEnergyEv, stoppingPotentialV }) => `阈频 ν₀ = ${formatNumber(thresholdFrequencyHz)} Hz；${emitted ? '有光电子逸出' : '频率低于阈值，无光电子逸出'}，Kₘₐₓ = ${formatNumber(maxKineticEnergyEv)} eV，遏止电压 V₀ = ${formatNumber(stoppingPotentialV)} V。适用条件：单光子能量 hν；表面逸出功固定。`,
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
  const amplitude = Math.max(state.amplitude, 0.01);
  for (let index = 0; index <= 60; index += 1) {
    const x = (index / 60) * state.wavelength * 2;
    const displacement = waveSample({ x, time, amplitude: state.amplitude, wavelength: state.wavelength, period: state.period, mode: state.mode });
    const px = 20 + index * 4;
    const py = 72 - (displacement / amplitude) * 38;
    path.push(`${index === 0 ? 'M' : 'L'}${px.toFixed(2)} ${py.toFixed(2)}`);
  }
  return path.join(' ');
}

function plotSvg(id, state, waveTime = 0) {
  if (id === 'pendulum') {
    const armLength = 48 + ((state.length - 0.2) / 1.8) * 48;
    const bobX = 140 + Math.sin(0.24) * armLength;
    const bobY = 22 + Math.cos(0.24) * armLength;
    return `<svg class="simulation-plot" viewBox="0 0 280 150" role="img" aria-label="小角单摆示意图"><path d="M140 20 A70 70 0 0 1 196 48" fill="none" stroke="#52677F" stroke-dasharray="3 5"/><circle cx="140" cy="20" r="4" fill="#F3BD65"/><g class="simulation-animation pendulum-swing"><line x1="140" y1="20" x2="${bobX.toFixed(2)}" y2="${bobY.toFixed(2)}" stroke="#82B6FF" stroke-width="2"/><circle cx="${bobX.toFixed(2)}" cy="${bobY.toFixed(2)}" r="13" fill="#73D9C7"/><circle cx="${bobX.toFixed(2)}" cy="${bobY.toFixed(2)}" r="4" fill="#071529"/></g><text x="149" y="137">ℓ = ${formatNumber(state.length)} m</text><text x="18" y="22">小角近似</text></svg>`;
  }
  if (id === 'wave') {
    const timeNote = state.mode === 'standing' ? '驻波随时间振荡，节点固定' : '行波形状随时间沿 +x 方向传播';
    return `<svg class="simulation-plot" viewBox="0 0 280 150" role="img" aria-label="${state.mode === 'standing' ? '驻波' : '行波'}位移曲线，${timeNote}"><path d="M20 72H260" stroke="#52677F"/><path data-wave-path="true" d="${wavePathData(state, waveTime)}" fill="none" stroke="#73D9C7" stroke-width="3" class="simulation-wave-line"/><text x="206" y="134">x（m）</text><text x="22" y="24">y（m）</text></svg>`;
  }
  if (id === 'interference') {
    const spacingMm = state.spacing * 1e3;
    const pitch = Math.max(3, Math.min(18, spacingMm * 5));
    const bands = Array.from({ length: 9 }, (_, index) => {
      const order = index - 4;
      const y = 75 + order * pitch;
      const opacity = Math.max(0.2, 1 - Math.abs(order) * 0.12);
      return `<line x1="208" y1="${y.toFixed(2)}" x2="246" y2="${y.toFixed(2)}" stroke="#73D9C7" stroke-width="${order === 0 ? 4 : 2}" opacity="${opacity.toFixed(2)}"/>`;
    }).join('');
    return `<svg class="simulation-plot" viewBox="0 0 280 150" role="img" aria-label="双缝与屏上明暗条纹示意图"><path d="M52 25V66 M52 84V125" stroke="#82B6FF" stroke-width="5"/><path d="M58 70L205 30 M58 80L205 120" stroke="#B39BFF" stroke-dasharray="4 5"/><path d="M205 18V132" stroke="#52677F" stroke-width="3"/>${bands}<text x="21" y="143">双缝</text><text x="205" y="143">观察屏</text></svg>`;
  }
  if (id === 'maxwell') {
    const molarMass = state.molarMass;
    const maxSpeed = state.speeds.rms * 2;
    const density = (speed) => 4 * Math.PI * (molarMass / (2 * Math.PI * UNIVERSAL_GAS_CONSTANT * state.temperature)) ** 1.5 * speed ** 2 * Math.exp(-molarMass * speed ** 2 / (2 * UNIVERSAL_GAS_CONSTANT * state.temperature));
    const peak = density(state.speeds.mostProbable) || 1;
    const points = [];
    for (let index = 0; index <= 50; index += 1) {
      const speed = (index / 50) * maxSpeed;
      const x = 28 + index * 4.5;
      const y = 122 - (density(speed) / peak) * 90;
      points.push(`${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    return `<svg class="simulation-plot" viewBox="0 0 280 150" role="img" aria-label="麦克斯韦速率分布曲线"><path d="M24 122H260 M24 122V20" stroke="#52677F"/><path d="${points.join(' ')}" fill="none" stroke="#73D9C7" stroke-width="3"/><line x1="${(28 + state.speeds.mostProbable / maxSpeed * 225).toFixed(2)}" y1="34" x2="${(28 + state.speeds.mostProbable / maxSpeed * 225).toFixed(2)}" y2="122" stroke="#F3BD65" stroke-dasharray="4 4"/><text x="190" y="143">速率 v（m/s）</text><text x="30" y="21">概率密度</text></svg>`;
  }
  if (id === 'carnot') {
    return '<svg class="simulation-plot" viewBox="0 0 280 150" role="img" aria-label="卡诺循环的压力体积图"><path d="M48 112 C58 56 101 33 145 38 C204 45 225 72 230 112 C179 123 102 126 48 112Z" fill="rgba(115,217,199,.08)" stroke="#73D9C7" stroke-width="3" stroke-dasharray="9 5" class="simulation-animation simulation-cycle-line"/><circle cx="48" cy="112" r="5" fill="#F3BD65"/><text x="212" y="137">体积 V</text><text x="22" y="27">压力 P</text><text x="51" y="131">1</text><text x="224" y="65">可逆循环</text></svg>';
  }
  if (id === 'relativity') {
    const width = Math.max(8, 140 * state.lengthContractionFactor);
    return `<svg class="simulation-plot" viewBox="0 0 280 150" role="img" aria-label="静止长度与运动方向收缩后长度比较"><text x="26" y="38">静止长度 L₀</text><rect x="28" y="48" width="140" height="18" rx="9" fill="#52677F"/><text x="26" y="95">运动长度 L</text><rect x="28" y="105" width="${width.toFixed(2)}" height="18" rx="9" fill="#73D9C7" class="simulation-animation simulation-contract-bar"/><text x="188" y="117">沿运动方向</text></svg>`;
  }
  if (id === 'photoelectric') {
    const electronCount = state.emitted ? 4 : 0;
    const electrons = Array.from({ length: electronCount }, (_, index) => `<circle cx="${(115 + index * 22).toFixed(2)}" cy="${(53 + (index % 2) * 35).toFixed(2)}" r="5" fill="#73D9C7" class="simulation-animation photoelectron"/>`).join('');
    return `<svg class="simulation-plot" viewBox="0 0 280 150" role="img" aria-label="入射光照射金属板并产生光电子的示意图"><rect x="40" y="34" width="12" height="82" fill="#82B6FF"/><rect x="230" y="34" width="12" height="82" fill="#F3BD65"/><text x="22" y="132">阴极</text><text x="222" y="132">阳极</text><path d="M65 75H95" stroke="#B39BFF" stroke-width="4" marker-end="url(#photonArrow)"/><defs><marker id="photonArrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7Z" fill="#B39BFF"/></marker></defs>${electrons}<text x="72" y="35">光子 hν</text></svg>`;
  }
  const rows = particleFamilies.interactions.map((interaction, index) => {
    const y = 30 + index * 27;
    const active = interaction.id === state.selected.id;
    return `<g opacity="${active ? '1' : '0.5'}"><rect x="20" y="${y}" width="240" height="21" rx="5" fill="${active ? '#173C4A' : '#10243B'}" stroke="${active ? '#73D9C7' : '#52677F'}"/><text x="30" y="${y + 15}">${escapeHtml(interaction.name)}</text><text x="125" y="${y + 15}">${escapeHtml(interaction.mediators.join('、') || '标准模型之外')}</text></g>`;
  }).join('');
  return `<svg class="simulation-plot" viewBox="0 0 280 150" role="img" aria-label="四种基本相互作用和媒介粒子列表">${rows}<text x="22" y="145">物质粒子：夸克 · 轻子</text></svg>`;
}

function visualMarkup(id, state, definition, waveTime = 0) {
  return `${plotSvg(id, state, waveTime)}<p class="simulation-fallback">${escapeHtml(definition.fallback)}</p>`;
}

function initialValues(definition) {
  return Object.fromEntries(definition.controls.map((control) => [control.name, control.valueType === 'number' ? Number(control.value) : control.value]));
}

export function mountSimulation(container, id) {
  const definition = simulationDefinitions[id];
  if (!definition || !container) throw new RangeError('未找到对应的物理演示容器。');

  const defaults = initialValues(definition);
  const firstState = definition.calculate(defaults);
  const controlsMarkup = definition.controls.map(parameterMarkup).join('');
  container.innerHTML = `
    <section class="simulation-card" aria-labelledby="simulation-title-${escapeHtml(id)}">
      <div class="simulation-heading"><div><span class="simulation-kicker">物理微型演示</span><h3 id="simulation-title-${escapeHtml(id)}">${escapeHtml(definition.title)}</h3></div>
        <button class="simulation-pause" type="button" data-action="pause" aria-pressed="false">暂停演示</button></div>
      <div class="simulation-controls">${controlsMarkup}</div>
      <p class="simulation-result" data-role="result" aria-live="polite"></p>
      <p class="simulation-validation" data-role="validation" role="status"></p>
      <div class="simulation-visual" data-role="visual">${visualMarkup(id, firstState, definition)}</div>
    </section>`;

  const controls = [...container.querySelectorAll('[data-param]')];
  const result = container.querySelector('[data-role="result"]');
  const validation = container.querySelector('[data-role="validation"]');
  const visual = container.querySelector('[data-role="visual"]');
  const pause = container.querySelector('[data-action="pause"]');
  if (!result || !validation || !visual || !pause) throw new Error('演示界面缺少必要的结果或控制区域。');

  const readValues = () => Object.fromEntries(controls.map((control) => {
    const name = control.dataset.param;
    const parameter = definition.controls.find((item) => item.name === name);
    const raw = control.value;
    if (parameter.valueType !== 'number') return [name, raw];
    const value = Number(raw);
    finiteNumber(parameter.label, value);
    return [name, value];
  }));

  let currentWaveState = null;
  let animationTime = 0;
  let previousFrameTime = null;
  let frameId = null;
  let cleaned = false;
  let isPaused = false;
  const motionQuery = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-reduced-motion: reduce)') : null;
  let systemReducedMotion = Boolean(motionQuery?.matches);
  if (systemReducedMotion) container.classList.add('reduced-motion');

  const appReducedMotion = () => Boolean(container.closest?.('.reduced-motion'));
  const stopWaveAnimation = () => {
    if (frameId !== null) globalThis.cancelAnimationFrame?.(frameId);
    frameId = null;
    previousFrameTime = null;
  };
  const mayAnimateWave = () => id === 'wave'
    && currentWaveState !== null
    && !cleaned
    && !isPaused
    && !systemReducedMotion
    && !appReducedMotion()
    && typeof globalThis.requestAnimationFrame === 'function';
  const animateWave = (timestamp) => {
    frameId = null;
    if (!mayAnimateWave()) {
      previousFrameTime = null;
      return;
    }
    if (Number.isFinite(timestamp) && Number.isFinite(previousFrameTime)) {
      const elapsed = Math.max(0, (timestamp - previousFrameTime) / 1000);
      animationTime = (animationTime + Math.min(elapsed, 0.1)) % currentWaveState.period;
    }
    previousFrameTime = Number.isFinite(timestamp) ? timestamp : null;
    const path = visual.querySelector?.('[data-wave-path]');
    if (path) path.setAttribute('d', wavePathData(currentWaveState, animationTime));
    if (mayAnimateWave()) frameId = globalThis.requestAnimationFrame(animateWave);
  };
  const syncWaveAnimation = () => {
    if (mayAnimateWave()) {
      if (frameId === null) frameId = globalThis.requestAnimationFrame(animateWave);
    } else {
      stopWaveAnimation();
    }
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

  const update = () => {
    try {
      const state = definition.calculate(readValues());
      result.textContent = definition.summary(state);
      validation.textContent = '';
      currentWaveState = id === 'wave' ? state : null;
      visual.innerHTML = visualMarkup(id, state, definition, animationTime);
      syncWaveAnimation();
    } catch (error) {
      currentWaveState = null;
      syncWaveAnimation();
      result.textContent = '暂不显示计算结果；请先修正参数。';
      validation.textContent = error instanceof RangeError ? error.message : '参数无效，请检查输入范围。';
      visual.innerHTML = `<p class="simulation-fallback">${escapeHtml(definition.fallback)}</p>`;
    }
    updateControlOutputs();
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
  pause.addEventListener('click', togglePause);

  update();

  return () => {
    for (const control of controls) {
      control.removeEventListener?.('input', update);
      control.removeEventListener?.('change', update);
    }
    pause.removeEventListener?.('click', togglePause);
    cleaned = true;
    stopWaveAnimation();
    motionObserver?.disconnect();
    removeMotionListener?.();
    container.classList.remove('simulation-paused');
    if (systemReducedMotion) container.classList.remove('reduced-motion');
    container.innerHTML = '';
  };
}
