// Exposes a small, explicit API to the renderer. The page never gets Node or
// file-system access; everything goes through these calls.
const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('fieldlogger', {
  isElectron: true,
  profiles: {
    list: () => invoke('profiles:list'),
    create: (input) => invoke('profiles:create', input),
    update: (id, patch) => invoke('profiles:update', id, patch),
    setPin: (id, pin) => invoke('profiles:setPin', id, pin),
    verifyPin: (id, pin) => invoke('profiles:verifyPin', id, pin),
    touch: (id) => invoke('profiles:touch', id),
    forget: () => invoke('profiles:forget'),
    remove: (id) => invoke('profiles:remove', id),
  },
  data: {
    load: (id) => invoke('data:load', id),
    save: (id, data) => invoke('data:save', id, data),
    saveSync: (id, data) => ipcRenderer.sendSync('data:saveSync', id, data),
    exportFile: (data, name) => invoke('data:export', data, name),
    importFile: () => invoke('data:import'),
    exportText: (text, name) => invoke('data:exportText', text, name),
  },
  updates: {
    config: () => invoke('updates:config'),
    setFolder: (folder) => invoke('updates:setFolder', folder),
    check: () => invoke('updates:check'),
    install: () => invoke('updates:install'),
  },
  backups: {
    list: (id) => invoke('backups:list', id),
    restore: (id, key) => invoke('backups:restore', id, key),
  },
  app: {
    info: () => invoke('app:info'),
    openDataFolder: () => invoke('app:openDataFolder'),
    openExternal: (url) => invoke('app:openExternal', url),
    setTitleBar: (colors) => invoke('app:titleBar', colors),
    setZoom: (factor) => invoke('app:zoom', factor),
  },
  clipboard: {
    write: (text) => invoke('clipboard:write', text),
  },
});
