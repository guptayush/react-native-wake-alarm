// Expo asks plugins to resolve config-plugins through the app's expo package so one copy is
// shared; the scoped package is the fallback for projects that install it directly.
function loadConfigPlugins(load = require) {
  try {
    return load('expo/config-plugins');
  } catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND') {
      return load('@expo/config-plugins');
    }
    throw error;
  }
}

module.exports = { loadConfigPlugins, ...loadConfigPlugins() };
