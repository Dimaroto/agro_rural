const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agroDesktop', {
  isDesktop: true,
  emissorBaseUrl: 'http://127.0.0.1:8001',
  startEmissor: (url) => ipcRenderer.invoke('emissor:start', url),
  openEmissor: (url) => ipcRenderer.invoke('emissor:open', url),
  showAdmin: () => ipcRenderer.invoke('app:show-admin'),
  isEmissorOnline: () => ipcRenderer.invoke('emissor:online'),
  /** Fetch ao emissor via processo principal (sem bloqueio HTTPS→HTTP). */
  requestEmissor: (opts) => ipcRenderer.invoke('emissor:request', opts),
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
