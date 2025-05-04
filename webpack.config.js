//@ts-check

'use strict';

const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

/** @type {import('webpack').Configuration} */
const config = {
  target: 'node',
  mode: 'none', // this will be set by the --mode flag in the package.json scripts

  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode' // the vscode-module is created on-the-fly and must be excluded
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  plugins: [
    // Copy the media directory to the output
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'media/icon.svg',
          to: 'media/icon.svg'
        },
        {
          from: 'media/logo.png',
          to: 'media/logo.png'
        },
        {
          from: 'media/chat.css',
          to: 'media/chat.css'
        },
        {
          from: 'media/chat.js',
          to: 'media/chat.js'
        },
        {
          from: 'media/codicon.css',
          to: 'media/codicon.css'
        }
      ]
    })
  ],
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    level: "log", // enables logging required for problem matchers
  },
};

module.exports = config;