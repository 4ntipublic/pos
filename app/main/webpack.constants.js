'use strict';

const path = require('path');
const { pathToFileURL } = require('url');

const isDev =
  process.env.NODE_ENV === 'development' ||
  process.defaultApp === true ||
  process.env.ELECTRON_IS_DEV === '1';

const devPort = process.env.WEBPACK_DEV_SERVER_PORT || '3000';
const devServerUrl =
  process.env.WEBPACK_DEV_SERVER_URL ||
  process.env.MAIN_WINDOW_WEBPACK_ENTRY ||
  `http://localhost:${devPort}/main_window/index.html`;

const mainWindowFile = path.join(
  __dirname,
  '..',
  '..',
  '.webpack',
  'renderer',
  'main_window',
  'index.html'
);
const mainWindowUrl = pathToFileURL(mainWindowFile).toString();

const MAIN_WINDOW_WEBPACK_ENTRY = isDev ? devServerUrl : mainWindowUrl;
const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY =
  process.env.MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY ||
  path.join(
    __dirname,
    '..',
    '..',
    '.webpack',
    'renderer',
    'main_window',
    'preload.js'
  );

module.exports = {
  MAIN_WINDOW_WEBPACK_ENTRY,
  MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
};
