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

function canonicalRaw(next, legacyProgressRaw) {
  return JSON.stringify({
    schemaVersion: 2,
    progressRaw: next.get(PROGRESS_KEY) ?? null,
    practiceRaw: next.get(PRACTICE_KEY) ?? null,
    legacyProgressRaw,
  });
}

export function createLearningStorage(nativeStorage) {
  if (!nativeStorage || typeof nativeStorage.getItem !== 'function' || typeof nativeStorage.setItem !== 'function') {
    return { storage: null, state: 'unavailable' };
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
      if (!validCanonical(parsed)) return { storage: null, state: 'damaged' };
      current = new Map([[PROGRESS_KEY, parsed.progressRaw], [PRACTICE_KEY, parsed.practiceRaw]]);
      if (legacyProgressRaw !== parsed.progressRaw) {
        if (Object.hasOwn(parsed, 'legacyProgressRaw') && legacyProgressRaw !== parsed.legacyProgressRaw) {
          if (!validLegacyProgress(legacyProgressRaw)) return { storage: null, state: 'damaged' };
          current.set(PROGRESS_KEY, legacyProgressRaw);
          nativeStorage.setItem(KEY, canonicalRaw(current, legacyProgressRaw));
        } else {
          try {
            if (parsed.progressRaw === null) nativeStorage.removeItem(PROGRESS_KEY);
            else nativeStorage.setItem(PROGRESS_KEY, parsed.progressRaw);
            legacyProgressRaw = parsed.progressRaw;
            nativeStorage.setItem(KEY, canonicalRaw(current, legacyProgressRaw));
          } catch { legacySyncState = 'out-of-sync'; }
        }
      } else if (parsed.legacyProgressRaw !== legacyProgressRaw) {
        try { nativeStorage.setItem(KEY, canonicalRaw(current, legacyProgressRaw)); }
        catch { legacySyncState = 'out-of-sync'; }
      }
    }
  } catch {
    return { storage: null, state: 'damaged' };
  }

  let draft = null;
  function persist(next) {
    const observedLegacy = nativeStorage.getItem(PROGRESS_KEY);
    if (observedLegacy !== legacyProgressRaw && observedLegacy !== current.get(PROGRESS_KEY)) {
      throw new Error('旧版页面同时修改了学习进度；请刷新后重试。');
    }
    legacyProgressRaw = observedLegacy;
    nativeStorage.setItem(KEY, canonicalRaw(next, legacyProgressRaw));
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
      nativeStorage.setItem(KEY, canonicalRaw(next, legacyProgressRaw));
      legacySyncState = 'in-sync';
    } catch {
      // The canonical v2 write succeeded. Keep that record available and retry the
      // legacy mirror at the next startup or mutation; warn before any rollback.
      legacySyncState = 'out-of-sync';
    }
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
    getLegacySyncState() { return legacySyncState; },
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
