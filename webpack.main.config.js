const path = require('path');

module.exports = {
  entry: path.resolve(__dirname, 'app', 'main', 'main.js'),
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
          },
        },
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.json'],
  },
};
