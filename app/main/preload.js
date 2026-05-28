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
  createProduct: (payload) => safeInvoke('db:createProduct', payload),
  updateProduct: (payload) => safeInvoke('db:updateProduct', payload),
  deleteProduct: (id) => safeInvoke('db:deleteProduct', id),
  completeSale: (payload) => safeInvoke('sales:complete', payload),
  getReceiptConfig: () => safeInvoke('settings:getReceiptConfig'),
  saveReceiptConfig: (payload) => safeInvoke('settings:saveReceiptConfig', payload),
  selectReceiptLogo: () => safeInvoke('settings:selectReceiptLogo'),
  printReceipt: (payload) => safeInvoke('hardware:printReceipt', payload),
  emitirBoleta: (cartData, total) => safeInvoke('sii:emitirBoleta', cartData, total),
});
