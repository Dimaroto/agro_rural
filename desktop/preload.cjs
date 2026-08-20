const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agroDesktop', {
  isDesktop: true,
  emissorBaseUrl: 'http://127.0.0.1:8000',
  startEmissor: (url) => ipcRenderer.invoke('emissor:start', url),
  openEmissor: (url) => ipcRenderer.invoke('emissor:open', url),
  showAdmin: () => ipcRenderer.invoke('app:show-admin'),
  toggleFullscreen: () => ipcRenderer.invoke('window:fullscreen'),
  onEmissorStatus: (cb) => {
    ipcRenderer.on('emissor:status', (_e, payload) => {
      if (typeof payload === 'boolean') {
        cb(payload, 'admin');
        return;
      }
      cb(!!payload?.online, payload?.mode === 'emissor' ? 'emissor' : 'admin');
    });
  },
});
