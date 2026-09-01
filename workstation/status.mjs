export function dolphinStatusLabel(status = {}) {
  if (status.running) return 'Dolphin · идёт проверка';
  if (status.lastError) return 'Dolphin · требуется внимание';
  if (status.sourceApi?.status === 'active') return 'Dolphin · автоматическое погашение работает';
  if (status.sourceApi?.status === 'diagnostic') return 'Dolphin · связь есть, режим проверки';
  if (status.configured === false) return 'Dolphin · подключение к серверу';
  if (status.lastSuccessAt) return 'Dolphin · последняя проверка успешна';
  return 'Dolphin · ожидает первую проверку';
}
