const fs = require('fs');
const path = require('path');
const {
  IOSConfig,
  withDangerousMod,
  withXcodeProject,
} = require('@expo/config-plugins');
const { classifySounds } = require('./lib/sounds');

module.exports = (config, props) => {
  if (!props.sounds) return config;

  config = withDangerousMod(config, [
    'android',
    (c) => {
      const src = path.join(c.modRequest.projectRoot, props.sounds);
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
    const src = path.join(c.modRequest.projectRoot, props.sounds);
    const projectName = IOSConfig.XcodeUtils.getProjectName(
      c.modRequest.projectRoot
    );
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
