const fs = require('fs');
const path = require('path');
const {
  IOSConfig,
  withDangerousMod,
  withXcodeProject,
} = require('./lib/configPlugins');
const { getProjectName, resolveSoundsDir } = require('./lib/project');
const { classifySounds } = require('./lib/sounds');

module.exports = (config, props) => {
  if (!props.sounds) return config;

  config = withDangerousMod(config, [
    'android',
    (c) => {
      const src = resolveSoundsDir(c.modRequest, props.sounds);
      const raw = path.join(
        c.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'raw'
      );
      fs.mkdirSync(raw, { recursive: true });
      const { android, rejected } = classifySounds(fs.readdirSync(src));
      if (rejected.length)
        throw new Error(
          `react-native-wake-alarm: Android resource names must match /^[a-z][a-z0-9_]*$/: ${rejected.join(', ')}`
        );
      android.forEach((f) =>
        fs.copyFileSync(path.join(src, f), path.join(raw, f))
      );
      return c;
    },
  ]);

  return withXcodeProject(config, (c) => {
    const src = resolveSoundsDir(c.modRequest, props.sounds);
    const projectName = getProjectName(c.modRequest);
    const { ios } = classifySounds(fs.readdirSync(src));
    for (const f of ios) {
      fs.copyFileSync(
        path.join(src, f),
        path.join(c.modRequest.platformProjectRoot, projectName, f)
      );
      if (!c.modResults.hasFile(`${projectName}/${f}`)) {
        IOSConfig.XcodeUtils.addResourceFileToGroup({
          filepath: `${projectName}/${f}`,
          groupName: projectName,
          project: c.modResults,
          isBuildFile: true,
        });
      }
    }
    return c;
  });
};
