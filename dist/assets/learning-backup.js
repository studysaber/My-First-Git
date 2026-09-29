function parseJson(serialized) {
  try { return JSON.parse(serialized); }
  catch { throw new TypeError('进度文件格式无效，无法读取。'); }
}

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function inspectProgress(payload, progress, knownNodes) {
  if (!plainObject(payload) || payload.version !== 1 || !plainObject(payload.progress)) {
    throw new TypeError('进度文件结构不符合要求。');
  }
  const unfamiliar = Object.keys(payload.progress).filter((id) => !knownNodes.has(id));
  if (unfamiliar.length) throw new TypeError(`未识别的知识点：${unfamiliar.join('、')}；未导入任何内容。`);
  return progress.previewImportJson(JSON.stringify(payload), knownNodes);
}

export function exportBackupJson(progress, practice, now = new Date()) {
  return JSON.stringify({
    schemaVersion: 2,
    exportedAt: new Date(now).toISOString(),
    selfAssessment: JSON.parse(progress.exportJson()),
    practice: { schemaVersion: 2, records: practice.getAll() },
  }, null, 2);
}

export function previewBackup(serialized, { progress, practice, knownNodes, knownQuestions }) {
  const payload = parseJson(serialized);
  if (!plainObject(payload)) throw new TypeError('进度文件结构不符合要求。');
  if (payload.version === 1) {
    return { version: 1, payload, progress: inspectProgress(payload, progress, knownNodes), practice: null };
  }
  if (payload.schemaVersion !== 2) throw new TypeError('不支持的进度文件版本，未导入任何内容。');
  if (typeof payload.exportedAt !== 'string' || Number.isNaN(Date.parse(payload.exportedAt))) {
    throw new TypeError('进度文件缺少有效导出时间。');
  }
  const progressPreview = inspectProgress(payload.selfAssessment, progress, knownNodes);
  const practicePreview = practice.previewImport(payload.practice, knownQuestions);
  if (!practicePreview.valid) throw new TypeError(practicePreview.errors.join('；'));
  return { version: 2, payload, progress: progressPreview, practice: practicePreview };
}
