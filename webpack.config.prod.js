const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
// https://webpack.js.org/plugins/css-minimizer-webpack-plugin/#getting-started

module.exports = {
  mode: 'production',
  entry: './src/index.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
      {
        test: /\.(png|jpe?g|gif)$/i,
        loader: 'file-loader',
      },
    ],
  },
  optimization: {
    minimizer: [
      '...', // this line extends existing minimizers
      new CssMinimizerPlugin()
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      favicon: './assets/favicon.ico',
      template: './public/index.html',
    }),
    new MiniCssExtractPlugin()
  ]
};