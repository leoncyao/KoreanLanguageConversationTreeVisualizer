const webpack = require('webpack');

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const backendPort = process.env.BACKEND_PORT || 5001; // default for dev
const backendHost = process.env.BACKEND_HOST || '99.230.251.252'; // Your IP for cross-device access
const backendUrl = `http://${backendHost}:${backendPort}`;

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: './public/src/index.js',
  output: {
    path: path.resolve(__dirname, 'public/static/js'),
    filename: 'bundle.js',
    publicPath: '/',
    clean: false,
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react'],
          },
        },
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      // Use actual backend URL for cross-device access (mobile, etc.)
      // Default to http://99.230.251.252:5001 for dev, :5000 for prod
      'process.env.API_BASE_URL': JSON.stringify(
        process.env.API_BASE_URL || backendUrl
      ),
    }),
    new HtmlWebpackPlugin({
      template: './public/index.html',
      filename: 'index.html',
    }),
  ],
  optimization: {
    removeAvailableModules: false,
    removeEmptyChunks: false,
    splitChunks: false,
  },
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename],
    },
  },
  devServer: {
    static: {
      directory: path.resolve(__dirname, 'public'),
      publicPath: '/',
      watch: {
        ignored: [path.resolve(__dirname, 'public/data/sentences.json')],
      },
    },
    host: '0.0.0.0', // Listen on all network interfaces for mobile access
    port: process.env.PORT || 3001,
    open: true,
    hot: true,
    liveReload: false,
    historyApiFallback: true,
    client: {
      overlay: {
        errors: true,
        warnings: false,
      },
      progress: true,
    },
    watchFiles: {
      paths: ['public/**/*', 'src/**/*'],
      options: {
        usePolling: false,
      },
    },
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
    },
  },
};
