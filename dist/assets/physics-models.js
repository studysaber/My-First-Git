const R = 8.31446261815324;
const validate = (name, value, min = -Infinity) => {
  if (!Number.isFinite(value) || value <= min) throw new RangeError(`${name} 必须是有效且大于 ${min} 的数值。`);
};

export function pendulumState({ length, gravity, amplitudeRad, time }) {
  validate('摆长', length, 0); validate('重力加速度', gravity, 0);
  validate('振幅角', amplitudeRad, 0); validate('时间', time);
  if (amplitudeRad < Math.PI / 180 || amplitudeRad > Math.PI / 18) throw new RangeError('小角模型仅允许 1—10° 振幅角。');
  const omega = Math.sqrt(gravity / length);
  const period = 2 * Math.PI / omega;
  const angle = amplitudeRad * Math.cos(omega * time);
  return { period, angle, angularVelocity: -amplitudeRad * omega * Math.sin(omega * time), angularAcceleration: -omega * omega * angle, x: length * Math.sin(angle), y: length * Math.cos(angle) };
}

export function waveSample({ x, time, amplitude, wavelength, period, mode }) {
  validate('位置', x); validate('时间', time); validate('振幅', amplitude, -Number.MIN_VALUE);
  validate('波长', wavelength, 0); validate('周期', period, 0);
  if (!['travelling', 'traveling', 'standing'].includes(mode)) throw new RangeError('波型无效。');
  const kx = 2 * Math.PI * x / wavelength;
  const wt = 2 * Math.PI * time / period;
  const displacement = mode === 'standing' ? 2 * amplitude * Math.sin(kx) * Math.cos(wt) : amplitude * Math.cos(kx - wt);
  if (!Number.isFinite(displacement)) throw new RangeError('位移结果超出有限精度。');
  return displacement;
}

export function maxwellDensity({ speed, temperature, molarMass }) {
  validate('速率', speed, -Number.MIN_VALUE);
  validate('温度', temperature, 0); validate('摩尔质量', molarMass, 0);
  const scale = molarMass / (2 * R * temperature);
  return 4 / Math.sqrt(Math.PI) * scale ** 1.5 * speed ** 2 * Math.exp(-scale * speed ** 2);
}

export function carnotCycle({ hotK, coldK }) {
  validate('高温', hotK, 0); validate('低温', coldK, 0);
  if (coldK > hotK) throw new RangeError('低温热源不能高于高温热源。');
  const gamma = 1.4;
  const expansion = (hotK / coldK) ** (1 / (gamma - 1));
  const vertices = [
    { volume: 1, pressure: R * hotK },
    { volume: 2, pressure: R * hotK / 2 },
    { volume: 2 * expansion, pressure: R * coldK / (2 * expansion) },
    { volume: expansion, pressure: R * coldK / expansion },
  ];
  if (vertices.some(({ volume, pressure }) => !Number.isFinite(volume) || !Number.isFinite(pressure))) throw new RangeError('温度比使循环超出可表示范围。');
  const names = ['高温等温膨胀', '绝热膨胀', '低温等温压缩', '绝热压缩'];
  const segments = names.map((name, index) => {
    const start = vertices[index], end = vertices[(index + 1) % 4];
    const points = Array.from({ length: 41 }, (_, i) => {
      const volume = start.volume * (end.volume / start.volume) ** (i / 40);
      const pressure = index % 2 === 0 ? start.pressure * start.volume / volume : start.pressure * (start.volume / volume) ** gamma;
      return { volume, pressure };
    });
    points[0] = start; points[40] = end;
    return { name, points };
  });
  const heatIn = R * hotK * Math.log(2);
  const heatOut = R * coldK * Math.log(2);
  return { segments, work: heatIn - heatOut, heatIn, heatOut, efficiency: 1 - coldK / hotK };
}

export function doubleSlitIntensity({ y, wavelength, slitSeparation, screenDistance }) {
  validate('屏上位置', y); validate('波长', wavelength, 0);
  validate('缝距', slitSeparation, 0); validate('屏距', screenDistance, 0);
  return Math.cos(Math.PI * slitSeparation * y / (wavelength * screenDistance)) ** 2;
}
