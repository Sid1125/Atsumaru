module.exports = function (api) {
  api.cache(true);

  return {
    presets: ["babel-preset-expo"],
    // Reanimated 4 compiles worklets through react-native-worklets. This plugin
    // must stay LAST in the list — anything after it will not be worklet-aware.
    plugins: ["react-native-worklets/plugin"],
  };
};
