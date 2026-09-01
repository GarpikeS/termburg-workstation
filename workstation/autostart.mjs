export const WORKSTATION_BACKGROUND_FLAG = '--background';

export function workstationLoginItemSettings(executablePath) {
  const path = String(executablePath || '').trim();
  if (!path) throw new Error('Workstation executable path is required for autostart.');
  return {
    openAtLogin: true,
    path,
    args: [WORKSTATION_BACKGROUND_FLAG],
  };
}

export function applyWorkstationAutoStart({
  electronApp,
  executablePath,
  platform = process.platform,
  packaged = electronApp?.isPackaged === true,
  disabled = false,
} = {}) {
  if (disabled || !packaged || platform !== 'win32') return false;
  if (typeof electronApp?.setLoginItemSettings !== 'function') {
    throw new Error('Electron login-item API is unavailable.');
  }
  electronApp.setLoginItemSettings(workstationLoginItemSettings(executablePath));
  return true;
}
