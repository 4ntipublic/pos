const path = require('path');

module.exports = {
  packagerConfig: {
    asar: true,
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'pos_progress',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32'],
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-webpack',
      config: {
        mainConfig: path.resolve(__dirname, 'webpack.main.config.js'),
        renderer: {
          config: path.resolve(__dirname, 'webpack.config.js'),
          entryPoints: [
            {
              html: path.resolve(__dirname, 'app', 'renderer', 'index.html'),
              js: path.resolve(__dirname, 'app', 'renderer', 'src', 'main.jsx'),
              name: 'main_window',
              preload: {
                js: path.resolve(__dirname, 'app', 'main', 'preload.js'),
              },
            },
          ],
        },
      },
    },
  ],
};
