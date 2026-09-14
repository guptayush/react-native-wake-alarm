const { withEntitlementsPlist, withInfoPlist } = require('./lib/configPlugins');
const { alarmKitInfoPlist, timeSensitiveEntitlements } = require('./lib/plist');

module.exports = (config, props) => {
  config = withInfoPlist(config, (c) => {
    c.modResults = alarmKitInfoPlist(c.modResults, props);
    return c;
  });
  return withEntitlementsPlist(config, (c) => {
    c.modResults = timeSensitiveEntitlements(c.modResults);
    return c;
  });
};
