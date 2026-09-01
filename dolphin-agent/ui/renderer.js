const elements = Object.fromEntries([
  'statusCard', 'statusTitle', 'statusMessage', 'syncButton', 'queueMetric', 'redeemedMetric',
  'apiMetric', 'configuredBadge', 'folderInput', 'autoSyncInput', 'autoStartInput',
  'chooseFolderButton', 'saveButton', 'rescanButton', 'actionResult', 'lastSyncDetail',
  'openDataButton', 'hideButton',
].map(id => [id, document.getElementById(id)]));

let current = null;
let busy = false;

function formatDate(value) {
  if (!value) return 'нет';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('ru-RU') : 'нет';
}

function statusPresentation(status) {
  if (!status.configured && status.lastError) return { tone: 'error', title: 'Не удалось подключиться', message: `${status.lastError} Проверьте интернет и нажмите «Проверить сейчас».` };
  if (!status.configured) return { tone: 'working', title: 'Подключаем компьютер', message: 'Ничего вводить не нужно — активация выполняется автоматически.' };
  if (status.running) return { tone: 'working', title: 'Идёт проверка', message: 'Проверяем локальный API Dolphin и резервные выгрузки.' };
  if (status.lastError) return { tone: 'error', title: 'Нужна проверка', message: status.lastError };
  if (status.sourceApi?.status === 'diagnostic') return { tone: 'ok', title: 'Dolphin найден', message: `Диагностика успешна: получено строк ${status.sourceApi.sourceRows || 0}. Автопогашение включим после проверки формата.` };
  if (status.sourceApi?.status === 'active') return { tone: 'ok', title: 'Автопогашение работает', message: `Dolphin доступен, найдено погашений: ${status.sourceApi.redemptions || 0}.` };
  if (status.lastSuccessAt) return { tone: 'ok', title: 'Всё работает', message: `Последняя успешная связь: ${formatDate(status.lastSuccessAt)}.` };
  return { tone: 'waiting', title: 'Готово к работе', message: 'Нажмите «Проверить сейчас» или дождитесь фоновой проверки.' };
}

function render(status) {
  current = status;
  const view = statusPresentation(status);
  elements.statusCard.dataset.tone = view.tone;
  elements.statusTitle.textContent = view.title;
  elements.statusMessage.textContent = view.message;
  elements.queueMetric.textContent = String(status.queueSize || 0);
  elements.redeemedMetric.textContent = String((status.redeemed || 0) + (status.alreadyRedeemed || 0));
  elements.apiMetric.textContent = String(status.sourceApi?.sourceRows || 0);
  elements.configuredBadge.textContent = status.configured ? 'Подключено' : 'Подключаем';
  elements.configuredBadge.classList.toggle('ok', status.configured);
  if (document.activeElement !== elements.folderInput) elements.folderInput.value = status.settings?.watchFolder || '';
  elements.autoSyncInput.checked = status.settings?.autoSync !== false;
  elements.autoStartInput.checked = status.settings?.autoStart !== false;
  const sourceStatus = status.sourceApi?.status === 'active'
    ? 'API активен'
    : status.sourceApi?.status === 'diagnostic'
      ? 'API проверяется'
      : status.sourceApi?.status === 'disabled'
        ? 'API не настроен'
        : status.sourceApi?.status === 'error'
          ? 'API недоступен'
          : 'API ожидает проверку';
  elements.lastSyncDetail.textContent = `Последняя проверка: ${formatDate(status.lastScanAt)} · ${sourceStatus} · в очереди: ${status.queueSize || 0} · версия ${status.appVersion || '—'}`;
  setBusy(status.running || busy);
}

function setBusy(value) {
  busy = value;
  for (const button of [elements.syncButton, elements.chooseFolderButton, elements.saveButton, elements.rescanButton]) {
    button.disabled = value;
  }
}

function showResult(message, error = false) {
  elements.actionResult.textContent = message;
  elements.actionResult.classList.toggle('error', error);
}

async function runAction(action, successMessage = '') {
  setBusy(true);
  showResult('');
  try {
    const result = await action();
    if (result?.settings) render(result);
    if (successMessage) showResult(successMessage);
    return result;
  } catch (error) {
    showResult(error?.message || String(error), true);
    throw error;
  } finally {
    setBusy(Boolean(current?.running));
  }
}

elements.chooseFolderButton.addEventListener('click', async () => {
  const folder = await window.dolphinAgent.chooseFolder();
  if (folder) elements.folderInput.value = folder;
});

elements.saveButton.addEventListener('click', () => void runAction(async () => {
  await window.dolphinAgent.saveSettings({
    watchFolder: elements.folderInput.value,
    autoSync: elements.autoSyncInput.checked,
    autoStart: elements.autoStartInput.checked,
  });
  await window.dolphinAgent.testConnection();
  return window.dolphinAgent.getStatus();
}, 'Изменения сохранены. Агент продолжает работать сам.').catch(() => {}));

elements.syncButton.addEventListener('click', () => void runAction(
  () => window.dolphinAgent.syncNow(false),
  'Проверка завершена.',
).catch(() => {}));

elements.rescanButton.addEventListener('click', () => void runAction(
  () => window.dolphinAgent.syncNow(true),
  'Все выгрузки перечитаны.',
).catch(() => {}));

elements.openDataButton.addEventListener('click', () => void window.dolphinAgent.openDataFolder());
elements.hideButton.addEventListener('click', () => void window.dolphinAgent.hideWindow());

window.dolphinAgent.onStatus(render);
window.dolphinAgent.getStatus().then(render).catch(error => showResult(error?.message || String(error), true));
