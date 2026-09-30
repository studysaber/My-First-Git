const KEY = 'physics-atlas-learning-v2';
const PROGRESS_KEY = 'physics-atlas-progress-v1';
const PRACTICE_KEY = 'physics-atlas-practice-v2';
const ALLOWED = new Set([PROGRESS_KEY, PRACTICE_KEY]);

function validCanonical(value) {
  return value?.schemaVersion === 2
    && (value.progressRaw === null || typeof value.progressRaw === 'string')
    && (value.practiceRaw === null || typeof value.practiceRaw === 'string')
    && (!Object.hasOwn(value, 'legacyProgressRaw') || value.legacyProgressRaw === null || typeof value.legacyProgressRaw === 'string');
}

function validLegacyProgress(raw) {
  if (raw === null) return true;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.version === 1 && parsed.progress !== null && typeof parsed.progress === 'object'
      && !Array.isArray(parsed.progress)
      && Object.values(parsed.progress).every((status) => ['new', 'review', 'mastered'].includes(status));
  } catch { return false; }
}

function canonicalRaw(next, legacyProgressRaw, envelope = {}) {
  return JSON.stringify({
    ...envelope,
    schemaVersion: 2,
    progressRaw: next.get(PROGRESS_KEY) ?? null,
    practiceRaw: next.get(PRACTICE_KEY) ?? null,
    legacyProgressRaw,
  });
}

function runExclusive(action) {
  return globalThis.navigator?.locks?.request
    ? globalThis.navigator.locks.request(KEY, action) : action();
}

function equal(left, right) {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length
    && keys.every((key) => Object.hasOwn(right, key) && equal(left[key], right[key]));
}

function entryPayload(key, raw) {
  const field = key === PROGRESS_KEY ? 'progress' : 'records';
  const version = key === PROGRESS_KEY ? { version: 1 } : { schemaVersion: 2 };
  if (raw === null) return { ...version, [field]: {} };
  const parsed = JSON.parse(raw);
  if (!parsed || (key === PROGRESS_KEY ? parsed.version !== 1 : parsed.schemaVersion !== 2)
    || !parsed[field] || typeof parsed[field] !== 'object' || Array.isArray(parsed[field])) throw Error('invalid');
  return parsed;
}

function reconcile(key, baseline, local, latest) {
  if (local === baseline) return latest;
  if (latest === baseline) return local;
  const conflict = () => { throw new Error('其他页面同时修改了同一条学习记录；请先导出临时记录，再刷新后重试。'); };
  if (local === null || latest === null) return conflict();
  let before, next, fresh;
  try {
    before = entryPayload(key, baseline);
    next = entryPayload(key, local);
    fresh = entryPayload(key, latest);
  } catch { return conflict(); }
  const field = key === PROGRESS_KEY ? 'progress' : 'records';
  // Reconcile only the documented entry collection; metadata is indivisible.
  const metadata = (payload) => Object.fromEntries(Object.entries(payload).filter(([name]) => name !== field));
  if (!equal(metadata(before), metadata(next)) || !equal(metadata(before), metadata(fresh))) return conflict();
  const entries = { ...fresh[field] };
  for (const id of new Set([...Object.keys(before[field]), ...Object.keys(next[field])])) {
    const had = Object.hasOwn(before[field], id), has = Object.hasOwn(next[field], id);
    if (had === has && equal(before[field][id], next[field][id])) continue;
    if (had !== Object.hasOwn(fresh[field], id) || !equal(before[field][id], fresh[field][id])) return conflict();
    if (has) Object.defineProperty(entries, id, { value: next[field][id], enumerable: true, configurable: true, writable: true });
    else delete entries[id];
  }
  return JSON.stringify({ ...fresh, [field]: entries });
}

export function createLearningStorage(nativeStorage) {
  if (!nativeStorage || typeof nativeStorage.getItem !== 'function' || typeof nativeStorage.setItem !== 'function') {
    return { storage: null, state: 'unavailable', refresh() {}, runExclusive };
  }
  let current;
  let legacyProgressRaw;
  let legacySyncState = 'in-sync';
  try {
    legacyProgressRaw = nativeStorage.getItem(PROGRESS_KEY);
    const raw = nativeStorage.getItem(KEY);
    if (raw === null) {
      current = new Map([
        [PROGRESS_KEY, legacyProgressRaw],
        [PRACTICE_KEY, nativeStorage.getItem(PRACTICE_KEY)],
      ]);
    } else {
      const parsed = JSON.parse(raw);
      if (!validCanonical(parsed)) throw new Error('损坏的学习记录。');
      current = new Map([[PROGRESS_KEY, parsed.progressRaw], [PRACTICE_KEY, parsed.practiceRaw]]);
      if (legacyProgressRaw !== parsed.progressRaw) {
        if (Object.hasOwn(parsed, 'legacyProgressRaw') && legacyProgressRaw !== parsed.legacyProgressRaw) {
          if (!validLegacyProgress(legacyProgressRaw)) throw new Error('损坏的学习记录。');
          current.set(PROGRESS_KEY, legacyProgressRaw);
          nativeStorage.setItem(KEY, canonicalRaw(current, legacyProgressRaw, parsed));
        } else {
          try {
            if (parsed.progressRaw === null) nativeStorage.removeItem(PROGRESS_KEY);
            else nativeStorage.setItem(PROGRESS_KEY, parsed.progressRaw);
            legacyProgressRaw = parsed.progressRaw;
            nativeStorage.setItem(KEY, canonicalRaw(current, legacyProgressRaw, parsed));
          } catch { legacySyncState = 'out-of-sync'; }
        }
      } else if (parsed.legacyProgressRaw !== legacyProgressRaw) {
        try { nativeStorage.setItem(KEY, canonicalRaw(current, legacyProgressRaw, parsed)); }
        catch { legacySyncState = 'out-of-sync'; }
      }
    }
  } catch {
    return { storage: null, state: 'damaged', refresh() {}, runExclusive };
  }

  let draft = null;
  let transactionBaseline = null;
  function readLatest() {
    const observedLegacy = nativeStorage.getItem(PROGRESS_KEY);
    const raw = nativeStorage.getItem(KEY);
    if (raw === null) return {
      values: new Map([[PROGRESS_KEY, observedLegacy], [PRACTICE_KEY, nativeStorage.getItem(PRACTICE_KEY)]]),
      legacy: observedLegacy, envelope: {},
    };
    let envelope;
    try { envelope = JSON.parse(raw); }
    catch { throw new Error('学习记录已损坏；请先导出临时记录，再刷新后恢复备份。'); }
    if (!validCanonical(envelope)) throw new Error('学习记录已损坏；请刷新后恢复备份。');
    const values = new Map([[PROGRESS_KEY, envelope.progressRaw], [PRACTICE_KEY, envelope.practiceRaw]]);
    if (observedLegacy !== envelope.progressRaw && Object.hasOwn(envelope, 'legacyProgressRaw')
      && observedLegacy !== envelope.legacyProgressRaw) {
      if (!validLegacyProgress(observedLegacy)) throw new Error('旧版学习记录已损坏；请刷新后恢复备份。');
      values.set(PROGRESS_KEY, observedLegacy);
    }
    return { values, legacy: observedLegacy, envelope };
  }
  function refresh() {
    if (draft) return;
    const latest = readLatest();
    current = latest.values;
    legacyProgressRaw = latest.legacy;
    legacySyncState = current.get(PROGRESS_KEY) === legacyProgressRaw ? 'in-sync' : 'out-of-sync';
  }
  function persist(proposed, baseline = current) {
    const latest = readLatest();
    const next = new Map([...ALLOWED].map((key) => [key,
      reconcile(key, baseline.get(key) ?? null, proposed.get(key) ?? null, latest.values.get(key) ?? null)]));
    // The first canonical write is the atomic commit point. Do not mutate the
    // session snapshot or rollback mirror until it succeeds.
    nativeStorage.setItem(KEY, canonicalRaw(next, latest.legacy, latest.envelope));
    legacyProgressRaw = latest.legacy;
    current = next;
    const nextProgressRaw = next.get(PROGRESS_KEY) ?? null;
    if (nextProgressRaw === legacyProgressRaw) {
      legacySyncState = 'in-sync';
      return;
    }
    try {
      if (nextProgressRaw === null) nativeStorage.removeItem(PROGRESS_KEY);
      else nativeStorage.setItem(PROGRESS_KEY, nextProgressRaw);
      legacyProgressRaw = nextProgressRaw;
      nativeStorage.setItem(KEY, canonicalRaw(next, legacyProgressRaw, latest.envelope));
      legacySyncState = 'in-sync';
    } catch {
      // The canonical v2 write succeeded. Keep that record available and retry the
      // legacy mirror at the next startup or mutation; warn before any rollback.
      legacySyncState = 'out-of-sync';
    }
  }
  const storage = {
    getItem(key) {
      refresh();
      return (draft ?? current).get(key) ?? null;
    },
    setItem(key, value) {
      if (!ALLOWED.has(key)) throw new TypeError('未知的学习记录类型。');
      const next = draft ?? new Map(current);
      next.set(key, String(value));
      if (!draft) persist(next);
    },
    removeItem(key) {
      if (!ALLOWED.has(key)) throw new TypeError('未知的学习记录类型。');
      const next = draft ?? new Map(current);
      next.set(key, null);
      if (!draft) persist(next);
    },
  };
  return {
    storage,
    state: 'persistent',
    refresh,
    runExclusive,
    getLegacySyncState() { return legacySyncState; },
    beginTransaction() {
      if (draft) throw new Error('已有导入事务。');
      refresh();
      transactionBaseline = new Map(current);
      draft = new Map(current);
    },
    commitTransaction() {
      if (!draft) throw new Error('没有待提交的导入事务。');
      const next = draft;
      const baseline = transactionBaseline;
      draft = null;
      transactionBaseline = null;
      persist(next, baseline);
    },
    rollbackTransaction() { draft = null; transactionBaseline = null; },
  };
}

export { KEY as learningStorageKey };
