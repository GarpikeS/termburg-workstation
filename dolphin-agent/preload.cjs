const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dolphinAgent', {
  getStatus: () => ipcRenderer.invoke('agent:get-status'),
  chooseFolder: () => ipcRenderer.invoke('agent:choose-folder'),
  saveSettings: value => ipcRenderer.invoke('agent:save-settings', value),
  syncNow: force => ipcRenderer.invoke('agent:sync-now', force === true),
  testConnection: () => ipcRenderer.invoke('agent:test-connection'),
  openDataFolder: () => ipcRenderer.invoke('agent:open-data-folder'),
  hideWindow: () => ipcRenderer.invoke('agent:hide-window'),
  onStatus: callback => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('agent:status', listener);
    return () => ipcRenderer.removeListener('agent:status', listener);
  },
});
