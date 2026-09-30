// Only the current authored versions belong in the actionable review queue.
export function currentDueQuestions(practice, questions, byNode, now = new Date()) {
  const current = new Map(questions.map((question) => [`${question.id}@${question.version}`, question]));
  return practice.getDue(now).flatMap((record) => {
    const question = current.get(`${record.questionId}@${record.questionVersion}`);
    return question && byNode.has(question.nodeId) ? [{ record, question, node: byNode.get(question.nodeId) }] : [];
  }).sort((left, right) => left.record.dueDate.localeCompare(right.record.dueDate)
    || left.question.id.localeCompare(right.question.id));
}

export function practiceRecordLabel(record) {
  if (!record) return '尚未作答';
  const evidence = record.lastCorrect ? '已通过 · 本次正确' : record.passed ? '曾通过 · 本次错误 · 待复习' : '尚未通过 · 本次错误 · 待复习';
  return `${evidence} · 作答 ${record.attempts} 次 · ${record.lastCorrect ? '下次复习' : '复习日期'} ${record.dueDate}`;
}

export function millisecondsUntilNextDay(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
}
