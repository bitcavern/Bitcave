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
  externals: {
    "@xenova/transformers": "commonjs2 @xenova/transformers",
    "better-sqlite3": "commonjs2 better-sqlite3",
    "sqlite-vec": "commonjs2 sqlite-vec",
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
      {
        test: /\.node$/,
        use: "node-loader",
      },
    ],
  },
  node: {
    __dirname: false,
    __filename: false,
  },
};
