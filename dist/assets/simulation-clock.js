export function createSimulationClock({ onFrame, requestFrame = globalThis.requestAnimationFrame?.bind(globalThis), cancelFrame = globalThis.cancelAnimationFrame?.bind(globalThis), visibility = globalThis.document } = {}) {
  if (typeof onFrame !== 'function') throw new TypeError('onFrame 必须是函数。');
  let time = 0, speed = 1, playing = false, pending = null, previous = null, destroyed = false;
  const stop = () => { if (pending !== null) cancelFrame?.(pending); pending = null; previous = null; };
  const frame = (stamp) => {
    pending = null;
    if (!playing || destroyed || visibility?.hidden) return;
    if (Number.isFinite(previous) && Number.isFinite(stamp)) time += Math.max(0, (stamp - previous) / 1000) * speed;
    previous = stamp;
    onFrame(time);
    pending = requestFrame?.(frame) ?? null;
  };
  const pause = () => { playing = false; stop(); };
  const onVisibility = () => { if (visibility?.hidden) pause(); };
  visibility?.addEventListener?.('visibilitychange', onVisibility);
  return {
    get time() { return time; }, get playing() { return playing; },
    play() { if (destroyed || playing || visibility?.hidden) return; playing = true; previous = null; pending = requestFrame?.(frame) ?? null; },
    pause,
    reset() { time = 0; previous = null; onFrame(time); },
    step(seconds) { if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('步进时间必须是非负有限数。'); time += seconds; onFrame(time); },
    setSpeed(multiplier) { if (!Number.isFinite(multiplier) || multiplier <= 0) throw new RangeError('倍率必须大于 0。'); speed = multiplier; },
    destroy() { pause(); destroyed = true; visibility?.removeEventListener?.('visibilitychange', onVisibility); },
  };
}
