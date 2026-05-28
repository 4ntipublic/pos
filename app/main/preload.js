'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const safeInvoke = async (channel, ...args) => {
  try {
    return await ipcRenderer.invoke(channel, ...args);
  } catch (err) {
    console.error(`[preload] ${channel} failed`, err);
    return { ok: false, error: 'IPC error' };
  }
};

contextBridge.exposeInMainWorld('api', {
  getProducts: () => safeInvoke('db:getProducts'),
  printReceipt: (payload) => safeInvoke('hardware:printReceipt', payload),
  emitirBoleta: (cartData, total) => safeInvoke('sii:emitirBoleta', cartData, total),
});
