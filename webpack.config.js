const webpack = require('webpack');

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

// Determine if we're in development or production
const isDev = process.env.NODE_ENV !== 'production';
const backendPort = process.env.BACKEND_PORT || (isDev ? 5001 : 5000);
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
      // Default to http://99.230.251.252:5001 for dev (port 5001), :5000 for prod
      // When accessing directly via backend (not webpack dev server), API_BASE_URL must be set
      'process.env.API_BASE_URL': JSON.stringify(
        process.env.API_BASE_URL || (isDev ? backendUrl : '')
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
        ignored: [
          path.resolve(__dirname, 'public/data/sentences.json'),
          path.resolve(__dirname, 'public/tts-cache/**/*'),
          path.resolve(__dirname, 'public/static/**/*'),
        ],
      },
    },
    host: '0.0.0.0', // Listen on all network interfaces for mobile access
    port: process.env.PORT || 3001,
    open: true,
    hot: true,
    liveReload: false,
    historyApiFallback: true,
    allowedHosts: [
      'neonleon.ca',
      'www.neonleon.ca',
      '.neonleon.ca', // Allow all subdomains
      'localhost',
      '127.0.0.1',
      '99.230.251.252', // Your public IP
    ],
    client: {
      overlay: {
        errors: true,
        warnings: false,
      },
      progress: true,
      reconnect: 0,
    },
    watchFiles: {
      paths: ['src/**/*', 'public/index.html', 'public/manifest.json'],
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
