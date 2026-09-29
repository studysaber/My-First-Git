const KEY = 'physics-atlas-learning-v2';
const PROGRESS_KEY = 'physics-atlas-progress-v1';
const PRACTICE_KEY = 'physics-atlas-practice-v2';
const ALLOWED = new Set([PROGRESS_KEY, PRACTICE_KEY]);

function validCanonical(value) {
  return value?.schemaVersion === 2
    && (value.progressRaw === null || typeof value.progressRaw === 'string')
    && (value.practiceRaw === null || typeof value.practiceRaw === 'string');
}

export function createLearningStorage(nativeStorage) {
  if (!nativeStorage || typeof nativeStorage.getItem !== 'function' || typeof nativeStorage.setItem !== 'function') {
    return { storage: null, state: 'unavailable' };
  }
  let current;
  try {
    const raw = nativeStorage.getItem(KEY);
    if (raw === null) {
      current = new Map([
        [PROGRESS_KEY, nativeStorage.getItem(PROGRESS_KEY)],
        [PRACTICE_KEY, nativeStorage.getItem(PRACTICE_KEY)],
      ]);
    } else {
      const parsed = JSON.parse(raw);
      if (!validCanonical(parsed)) return { storage: null, state: 'damaged' };
      current = new Map([[PROGRESS_KEY, parsed.progressRaw], [PRACTICE_KEY, parsed.practiceRaw]]);
    }
  } catch {
    return { storage: null, state: 'damaged' };
  }

  let draft = null;
  function persist(next) {
    nativeStorage.setItem(KEY, JSON.stringify({
      schemaVersion: 2,
      progressRaw: next.get(PROGRESS_KEY) ?? null,
      practiceRaw: next.get(PRACTICE_KEY) ?? null,
    }));
    current = next;
  }
  const storage = {
    getItem(key) {
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
    beginTransaction() {
      if (draft) throw new Error('已有导入事务。');
      draft = new Map(current);
    },
    commitTransaction() {
      if (!draft) throw new Error('没有待提交的导入事务。');
      const next = draft;
      draft = null;
      persist(next);
    },
    rollbackTransaction() { draft = null; },
  };
}

export { KEY as learningStorageKey };
