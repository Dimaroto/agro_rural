const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agroDesktop', {
  isDesktop: true,
  startEmissor: () => ipcRenderer.invoke('emissor:start'),
  openEmissor: () => ipcRenderer.invoke('emissor:open'),
  toggleFullscreen: () => ipcRenderer.invoke('window:fullscreen'),
  onEmissorStatus: (cb) => {
    ipcRenderer.on('emissor:status', (_e, online) => cb(!!online));
  },
});
