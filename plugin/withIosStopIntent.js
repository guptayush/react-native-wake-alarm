const fs = require('fs');
const path = require('path');
const {
  IOSConfig,
  withAppDelegate,
  withXcodeProject,
} = require('@expo/config-plugins');
const { injectAppDelegate } = require('./lib/appDelegate');

const TEMPLATE = path.join(
  __dirname,
  '..',
  'ios',
  'Templates',
  'WakeAlarmIntents.swift'
);
const FILE = 'WakeAlarmIntents.swift';

module.exports = (config) => {
  config = withXcodeProject(config, (c) => {
    const projectName = IOSConfig.XcodeUtils.getProjectName(
      c.modRequest.projectRoot
    );
    const dest = path.join(c.modRequest.platformProjectRoot, projectName, FILE);
    fs.copyFileSync(TEMPLATE, dest);
    if (!c.modResults.hasFile(`${projectName}/${FILE}`)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: `${projectName}/${FILE}`,
        groupName: projectName,
        project: c.modResults,
      });
    }
    return c;
  });
  return withAppDelegate(config, (c) => {
    if (c.modResults.language !== 'swift') {
      throw new Error(
        'react-native-wake-alarm: the Expo plugin needs a Swift AppDelegate (Expo SDK 53 or newer).'
      );
    }
    c.modResults.contents = injectAppDelegate(c.modResults.contents);
    return c;
  });
};
