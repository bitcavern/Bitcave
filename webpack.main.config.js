const path = require("path");

module.exports = {
  target: "electron-main",
  entry: {
    main: "./src/main/main.ts",
    preload: "./src/main/preload.ts",
  },
  output: {
    path: path.resolve(__dirname, "dist/main"),
    filename: "[name].js",
  },
  devtool: "source-map",
  resolve: {
    extensions: [".ts", ".js"],
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: "ts-loader",
          options: {
            configFile: "tsconfig.main.json",
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  node: {
    __dirname: false,
    __filename: false,
  },
};
