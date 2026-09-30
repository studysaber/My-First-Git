import { questions } from './data/practice-data.js';

const STORAGE_KEY = 'physics-atlas-practice-v2';
const DAY_MS = 86400000;

export function questionsByNode(nodeId) {
  return questions.filter((question) => question.nodeId === nodeId);
}

export function gradeAnswer(question, answer) {
  const expectedUnit = question?.unit ?? null;
  const explanation = question?.explanation || '请返回知识点核对条件和推理。';
  let correct = false;
  let reason = '';
  if (question?.kind === 'numeric') {
    const raw = answer?.value;
    const value = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() && /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(raw.trim()) ? Number(raw) : NaN;
    const unit = typeof answer?.unit === 'string' ? answer.unit.trim() : '';
    if (!Number.isFinite(value)) reason = '请输入有限的数值。';
    else if (unit !== expectedUnit) reason = `单位应为 ${expectedUnit}。`;
    else {
      const finiteTolerance = (raw) => typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : 0;
      const absolute = finiteTolerance(question.tolerance?.absolute);
      const relative = finiteTolerance(question.tolerance?.relative);
      correct = Math.abs(value - question.answer) <= Math.max(absolute, Math.abs(question.answer) * relative);
      if (!correct) reason = '数值不在允许误差内。';
    }
  } else if (question?.kind === 'concept' || question?.kind === 'interpretation') {
    const choice = typeof answer === 'string' ? answer : answer?.optionId;
    correct = question.options?.some((option) => option.id === choice) === true && choice === question.answer;
    if (!correct) reason = '选项不正确。';
  } else reason = '题目类型无法判定。';
  return { correct, feedback: `${correct ? '回答正确。' : reason} ${explanation}`, expectedUnit };
}

function localDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) throw new TypeError('作答时间无效。');
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addLocalDays(date, days) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  return localDate(d);
}

function recordKey(question) {
  if (typeof question?.id !== 'string' || !Number.isInteger(question?.version) || question.version < 1) throw new TypeError('题目缺少有效 id 或版本。');
  return `${question.id}@${question.version}`;
}

function inspectSnapshot(snapshot, knownQuestionIds) {
  const errors = [];
  if (!snapshot || snapshot.schemaVersion !== 2 || !snapshot.records || typeof snapshot.records !== 'object' || Array.isArray(snapshot.records)) {
    return { valid: false, accepted: 0, errors: ['练习快照格式或版本无效。'] };
  }
  const known = new Set(knownQuestionIds ?? questions.map((question) => question.id));
  let accepted = 0;
  for (const [key, record] of Object.entries(snapshot.records)) {
    const date = typeof record?.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(record.dueDate)
      ? new Date(`${record.dueDate}T00:00:00Z`) : null;
    const validDate = date && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === record.dueDate;
    const valid = record && typeof record === 'object' && !Array.isArray(record)
      && known.has(record.questionId) && key === `${record.questionId}@${record.questionVersion}`
      && Number.isInteger(record.questionVersion) && record.questionVersion >= 1
      && typeof record.nodeId === 'string' && record.nodeId.length > 0
      && Number.isInteger(record.attempts) && record.attempts >= 1
      && typeof record.firstCorrect === 'boolean' && typeof record.lastCorrect === 'boolean'
      && typeof record.passed === 'boolean' && (!(record.firstCorrect || record.lastCorrect) || record.passed)
      && Number.isInteger(record.stage) && record.stage >= 0 && record.stage <= 3
      && validDate && typeof record.lastAnsweredAt === 'string' && !Number.isNaN(Date.parse(record.lastAnsweredAt))
      && Number.isInteger(record.timezoneOffsetMinutes) && Math.abs(record.timezoneOffsetMinutes) <= 840
      && typeof record.lastFeedback === 'string' && typeof record.awaitingNewAttempt === 'boolean';
    if (valid) accepted += 1;
    else errors.push(`无效练习记录：${key}`);
  }
  return { valid: errors.length === 0, accepted, errors };
}

export function createPracticeStore(storage) {
  let memory = {};
  let persistence = storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function' ? 'persistent' : 'memory';
  const temporary = new Set();
  function refresh() {
    if (!storage || typeof storage.getItem !== 'function') return;
    try {
      const raw = storage.getItem(STORAGE_KEY);
      let records = {};
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (parsed?.schemaVersion !== 2 || !parsed.records || typeof parsed.records !== 'object' || Array.isArray(parsed.records)) throw new TypeError('旧版或损坏的练习记录');
        const preview = inspectSnapshot(parsed, Object.values(parsed.records).map((record) => record?.questionId));
        if (!preview.valid) throw new TypeError(preview.errors.join('；'));
        records = parsed.records;
      }
      // Temporary records stay exportable even if a later refresh can read
      // persistent data again. They must never silently overwrite disk data.
      const next = { ...records };
      for (const key of temporary) {
        if (Object.hasOwn(memory, key)) next[key] = memory[key];
        else delete next[key];
      }
      memory = next;
    } catch {
      persistence = 'memory';
      for (const key of Object.keys(memory)) temporary.add(key);
    }
  }
  refresh();
  const save = () => {
    if (persistence !== 'persistent') return;
    try { storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 2, records: memory })); }
    catch { persistence = 'memory'; }
  };
  return {
    refresh,
    getRecord(question) {
      refresh();
      return memory[recordKey(question)] ? structuredClone(memory[recordKey(question)]) : null;
    },
    getAll() { refresh(); return structuredClone(memory); },
    getPersistenceState() { return persistence; },
    previewImport(snapshot, knownQuestionIds) {
      const preview = inspectSnapshot(snapshot, knownQuestionIds);
      refresh();
      const entries = preview.valid ? Object.entries(snapshot.records) : [];
      const added = entries.filter(([key]) => !Object.hasOwn(memory, key)).length;
      const conflicts = entries.filter(([key, record]) => Object.hasOwn(memory, key)
        && Object.keys(record).some((field) => record[field] !== memory[key][field])).length;
      return { ...preview, imported: preview.accepted, added, conflicts };
    },
    importSnapshot(snapshot, { mode = 'merge', knownQuestionIds } = {}) {
      if (mode !== 'merge' && mode !== 'replace') throw new TypeError('导入模式必须为 merge 或 replace。');
      const preview = this.previewImport(snapshot, knownQuestionIds);
      if (!preview.valid) throw new TypeError(preview.errors.join('；'));
      refresh();
      const next = mode === 'replace' ? { ...snapshot.records } : { ...memory };
      if (mode === 'merge') {
        for (const [key, incoming] of Object.entries(snapshot.records)) {
          if (!Object.hasOwn(next, key)) next[key] = incoming;
        }
      }
      const owned = structuredClone(next);
      if (persistence === 'persistent') storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 2, records: owned }));
      else for (const key of new Set([...Object.keys(memory), ...Object.keys(owned)])) temporary.add(key);
      memory = owned;
      return preview;
    },
    beginAttempt(question) {
      refresh();
      const key = recordKey(question);
      if (memory[key]) {
        memory[key] = { ...memory[key], awaitingNewAttempt: true };
        save();
        if (persistence === 'memory') temporary.add(key);
      }
    },
    submit(question, answer, now = new Date()) {
      refresh();
      const key = recordKey(question);
      const date = now instanceof Date ? now : new Date(now);
      const today = localDate(date);
      const prior = memory[key];
      if (prior && !prior.awaitingNewAttempt) return {
        result: { correct: prior.lastCorrect, feedback: prior.lastFeedback, expectedUnit: question.unit ?? null },
        record: structuredClone(prior), recorded: false,
      };
      const result = gradeAnswer(question, answer);
      const previousStage = prior?.stage ?? 0;
      const eligible = prior?.dueDate && today >= prior.dueDate;
      const stage = result.correct ? (!prior?.passed || !prior?.dueDate || prior?.stage === 0 ? 1 : eligible ? Math.min(previousStage + 1, 3) : previousStage) : 0;
      const interval = [0, 1, 3, 7][stage];
      const dueDate = result.correct ? (eligible || !prior?.dueDate || previousStage === 0 ? addLocalDays(date, interval) : prior.dueDate) : today;
      const record = {
        questionId: question.id, questionVersion: question.version, nodeId: question.nodeId,
        attempts: (prior?.attempts ?? 0) + 1,
        firstCorrect: prior?.firstCorrect ?? result.correct,
        lastCorrect: result.correct, lastFeedback: result.feedback, passed: Boolean(prior?.passed || result.correct),
        stage, dueDate, lastAnsweredAt: date.toISOString(), timezoneOffsetMinutes: date.getTimezoneOffset(),
        awaitingNewAttempt: false,
      };
      memory = { ...memory, [key]: record };
      save();
      if (persistence === 'memory') temporary.add(key);
      return { result, record: structuredClone(record), recorded: true };
    },
    getDue(now = new Date()) {
      refresh();
      const today = localDate(now);
      return Object.values(memory).filter((record) => record.dueDate <= today).map((record) => structuredClone(record));
    },
  };
}
