const path = require('path');

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: path.resolve(__dirname, 'app', 'renderer', 'src', 'main.jsx'),
  output: {
    path: path.resolve(__dirname, 'app', 'renderer', 'dist'),
    filename: 'bundle.js',
    publicPath: '/dist/',
  },
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', { targets: 'defaults' }],
              ['@babel/preset-react', { runtime: 'automatic' }],
            ],
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
      {
        test: /\.(png|jpe?g|gif|svg|webp|woff2?|ttf|eot)$/i,
        type: 'asset/resource',
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx', '.json'],
  },
  devServer: {
    static: {
      directory: path.resolve(__dirname, 'app', 'renderer'),
    },
    port: 8080,
    hot: true,
    compress: true,
    devMiddleware: {
      publicPath: '/dist/',
    },
    client: {
      overlay: true,
    },
  },
};
