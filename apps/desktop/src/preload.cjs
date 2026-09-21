const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  state: () => ipcRenderer.invoke('launcher:state'),
  select: () => ipcRenderer.invoke('launcher:select'),
  start: () => ipcRenderer.invoke('launcher:start'),
  stop: () => ipcRenderer.invoke('launcher:stop'),
  open: () => ipcRenderer.invoke('launcher:open'),
  subscribe: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('launcher:state', listener);
    return () => ipcRenderer.removeListener('launcher:state', listener);
  },
});
