const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
});
