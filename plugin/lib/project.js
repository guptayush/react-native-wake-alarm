const fs = require('fs');
const path = require('path');
const { IOSConfig } = require('./configPlugins');

const getProjectName = (modRequest) =>
  IOSConfig.XcodeUtils.getProjectName(modRequest.projectRoot);

// Checked before readdirSync so a typo in `sounds` fails with the resolved path, not a raw ENOENT.
function resolveSoundsDir(modRequest, sounds) {
  const dir = path.join(modRequest.projectRoot, sounds);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`react-native-wake-alarm: sounds folder not found: ${dir}`);
  }
  return dir;
}

module.exports = { getProjectName, resolveSoundsDir };
