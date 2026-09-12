const { createRunOncePlugin } = require('@expo/config-plugins');
const pkg = require('../package.json');
const withIosAlarmKit = require('./withIosAlarmKit');
const withIosStopIntent = require('./withIosStopIntent');
const withSounds = require('./withSounds');

const withWakeAlarm = (config, props = {}) =>
  withSounds(withIosStopIntent(withIosAlarmKit(config, props)), props);

module.exports = createRunOncePlugin(withWakeAlarm, pkg.name, pkg.version);
