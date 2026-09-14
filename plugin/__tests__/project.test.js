const fs = require('fs');
const os = require('os');
const path = require('path');
const { describe, expect, it } = require('@jest/globals');

jest.mock('../lib/configPlugins', () => ({
  IOSConfig: { XcodeUtils: { getProjectName: (root) => `Name(${root})` } },
}));
const { getProjectName, resolveSoundsDir } = require('../lib/project');

describe('project helpers', () => {
  it('reads the iOS project name from the project root', () => {
    expect(getProjectName({ projectRoot: '/app' })).toBe('Name(/app)');
  });
  it('resolves an existing sounds folder relative to the project root', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wake-alarm-'));
    fs.mkdirSync(path.join(root, 'assets', 'sounds'), { recursive: true });
    expect(resolveSoundsDir({ projectRoot: root }, 'assets/sounds')).toBe(
      path.join(root, 'assets', 'sounds')
    );
  });
  it('names the resolved path when the folder is missing or is a file', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wake-alarm-'));
    fs.writeFileSync(path.join(root, 'notes.txt'), '');
    expect(() => resolveSoundsDir({ projectRoot: root }, 'missing')).toThrow(
      `react-native-wake-alarm: sounds folder not found: ${path.join(root, 'missing')}`
    );
    expect(() => resolveSoundsDir({ projectRoot: root }, 'notes.txt')).toThrow(
      'sounds folder not found'
    );
  });
});
