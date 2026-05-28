'use strict';

const fs = require('fs');
const path = require('path');
const { app, dialog } = require('electron');

const DEFAULT_CONFIG = {
  fantasyName: '',
  legalName: '',
  address: '',
  logoPath: '',
  logoDataUrl: '',
  logoName: '',
};

const getConfigPath = () => path.join(app.getPath('userData'), 'receipt-config.json');

const sanitizeConfig = (payload) => ({
  fantasyName: String(payload && payload.fantasyName ? payload.fantasyName : '').trim(),
  legalName: String(payload && payload.legalName ? payload.legalName : '').trim(),
  address: String(payload && payload.address ? payload.address : '').trim(),
  logoPath: String(payload && payload.logoPath ? payload.logoPath : ''),
  logoDataUrl: String(payload && payload.logoDataUrl ? payload.logoDataUrl : ''),
  logoName: String(payload && payload.logoName ? payload.logoName : ''),
});

const loadReceiptConfig = () => {
  const configPath = getConfigPath();
  try {
    if (!fs.existsSync(configPath)) {
      return { ...DEFAULT_CONFIG };
    }

    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...sanitizeConfig(parsed) };
  } catch (err) {
    console.error('[settings] load config failed', err);
    return { ...DEFAULT_CONFIG };
  }
};

const saveReceiptConfig = (payload) => {
  const configPath = getConfigPath();
  const config = { ...DEFAULT_CONFIG, ...sanitizeConfig(payload) };

  try {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return config;
  } catch (err) {
    console.error('[settings] save config failed', err);
    throw err;
  }
};

const selectReceiptLogo = async () => {
  const result = await dialog.showOpenDialog({
    title: 'Seleccionar logo',
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg'] },
    ],
  });

  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return { ok: false, canceled: true };
  }

  const filePath = result.filePaths[0];
  try {
    const raw = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase().replace('.', '') || 'png';
    const mime = ext === 'jpg' ? 'jpeg' : ext;
    const dataUrl = `data:image/${mime};base64,${raw.toString('base64')}`;

    return {
      ok: true,
      path: filePath,
      dataUrl,
      name: path.basename(filePath),
    };
  } catch (err) {
    console.error('[settings] logo read failed', err);
    return { ok: false, error: 'No se pudo leer el logo' };
  }
};

module.exports = {
  loadReceiptConfig,
  saveReceiptConfig,
  selectReceiptLogo,
};
