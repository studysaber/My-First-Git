// These are prompts for making a prediction before adjusting a demonstration.
// They are not graded practice records and do not change mastery status.
const predictions = Object.freeze({
  pendulum: {
    prompt: '小角单摆的摆长从 0.5 m 增至 2.0 m，g 与摆角不变。周期会怎样？',
    options: [{ id: 'period-double', text: '变为两倍' }, { id: 'period-quadruple', text: '变为四倍' }, { id: 'period-same', text: '保持不变' }],
    answer: 'period-double',
    explanation: 'T∝√ℓ；摆长变为 4 倍，周期变为 2 倍。请把滑块分别设为 0.5 m 与 2.0 m 核对读数。',
  },
  wave: {
    prompt: '选驻波并把每列入射波振幅 A 加倍，节点与波腹的最大位移怎样变化？',
    options: [{ id: 'antinode-double', text: '节点仍为零，波腹最大位移加倍' }, { id: 'nodes-move', text: '节点位移也加倍' }, { id: 'antinode-same', text: '波腹最大位移不变' }],
    answer: 'antinode-double',
    explanation: '理想同频同幅相向波的驻波波腹振幅为 2A，节点位移始终为零。',
  },
  interference: {
    prompt: '双缝间距 d 加倍，波长 λ 和屏距 L 不变，近轴亮纹间距会怎样？',
    options: [{ id: 'half', text: '减半' }, { id: 'double', text: '加倍' }, { id: 'same', text: '不变' }],
    answer: 'half',
    explanation: '远屏小角模型中 Δy=λL/d；d 加倍，亮纹间距减半。',
  },
  maxwell: {
    prompt: '同一种稀薄气体从 300 K 加热到 600 K，速率分布曲线怎样变？',
    options: [{ id: 'right-lower', text: '峰移向高速侧且峰值降低' }, { id: 'left-higher', text: '峰移向低速侧且峰值升高' }, { id: 'unchanged', text: '曲线完全不变' }],
    answer: 'right-lower',
    explanation: '最概然速率与 √T 成正比；归一化分布展宽后峰值降低，曲线下面积仍为 1。',
  },
  carnot: {
    prompt: '理想卡诺热机的低温热源逐渐升到与高温热源相同，效率与净功怎样？',
    options: [{ id: 'zero', text: '都趋于零' }, { id: 'hundred', text: '效率趋于 100%' }, { id: 'same', text: '都保持原值' }],
    answer: 'zero',
    explanation: 'η=1−T꜀/Tₕ；两热源同温时 η=0，所示理想循环的净功也为零。',
  },
  relativity: {
    prompt: '同一运动钟的速度比 β 从 0.6 增至 0.8，实验室系比较的 τ/t 怎样？',
    options: [{ id: 'smaller', text: '变小' }, { id: 'larger', text: '变大' }, { id: 'same', text: '不变' }],
    answer: 'smaller',
    explanation: 'τ/t=1/γ=√(1−β²)，β 越大，比值越小；比较必须明确两时间属于哪个参考系。',
  },
  photoelectric: {
    prompt: '频率仍低于固定金属的阈频，只增加入射光强，会出现光电子吗？',
    options: [{ id: 'none', text: '不会，单个光子能量仍不足' }, { id: 'more', text: '会，光子数可以补足单光子能量' }, { id: 'late', text: '照得足够久就一定会' }],
    answer: 'none',
    explanation: '单光子光电效应要求 hν≥Φ；光强不改变单个光子的能量。',
  },
  particles: {
    prompt: '从强相互作用切换到引力，媒介粒子一栏应如何解释？',
    options: [{ id: 'not-confirmed', text: '标准模型内没有确认的引力媒介粒子' }, { id: 'gluon', text: '仍是胶子' }, { id: 'photon', text: '改为光子' }],
    answer: 'not-confirmed',
    explanation: '标准模型描述强、电磁和弱相互作用；引力不属于其规范相互作用，假设的引力子尚未被确认。',
  },
});

export function getPrediction(simulationId) {
  return predictions[simulationId] ?? null;
}

export function gradePrediction(simulationId, optionId) {
  const prediction = getPrediction(simulationId);
  if (!prediction) return { correct: false, feedback: '此演示没有预测题。' };
  const valid = prediction.options.some((option) => option.id === optionId);
  if (!valid) return { correct: false, feedback: '请先选择一个预测。' };
  const correct = optionId === prediction.answer;
  return { correct, feedback: `${correct ? '预测正确。' : '预测与模型不符。'} ${prediction.explanation}` };
}
