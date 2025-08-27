const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  target: "electron-renderer",
  entry: "./src/renderer/index.tsx",
  output: {
    path: path.resolve(__dirname, "dist/renderer"),
    filename: "renderer.js",
  },
  devtool: "source-map",
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"],
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: "ts-loader",
          options: {
            configFile: "tsconfig.renderer.json",
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./src/renderer/index.html",
    }),
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, "dist/renderer"),
    },
    port: 3000,
    hot: true,
  },
};
