import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyWorkstationAutoStart,
  workstationLoginItemSettings,
  WORKSTATION_BACKGROUND_FLAG,
} from './autostart.mjs';

test('registers the installed Workstation to start in background on Windows login', () => {
  let received = null;
  const applied = applyWorkstationAutoStart({
    electronApp: {
      isPackaged: true,
      setLoginItemSettings(settings) { received = settings; },
    },
    executablePath: 'C:\\Program Files\\Termburg\\Workstation.exe',
    platform: 'win32',
  });
  assert.equal(applied, true);
  assert.deepEqual(received, {
    openAtLogin: true,
    path: 'C:\\Program Files\\Termburg\\Workstation.exe',
    args: [WORKSTATION_BACKGROUND_FLAG],
  });
});

test('does not modify login items in development, smoke tests or non-Windows builds', () => {
  const electronApp = {
    isPackaged: false,
    setLoginItemSettings() { throw new Error('must not be called'); },
  };
  assert.equal(applyWorkstationAutoStart({ electronApp, executablePath: 'app.exe', platform: 'win32' }), false);
  assert.equal(applyWorkstationAutoStart({ electronApp: { ...electronApp, isPackaged: true }, executablePath: 'app.exe', platform: 'linux' }), false);
  assert.equal(applyWorkstationAutoStart({ electronApp: { ...electronApp, isPackaged: true }, executablePath: 'app.exe', platform: 'win32', disabled: true }), false);
});

test('rejects an empty executable path', () => {
  assert.throws(() => workstationLoginItemSettings(''), /executable path/i);
});
