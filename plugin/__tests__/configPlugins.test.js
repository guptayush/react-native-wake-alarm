const { describe, expect, it } = require('@jest/globals');
const { loadConfigPlugins } = require('../lib/configPlugins');

describe('loadConfigPlugins', () => {
  it('prefers expo/config-plugins when the app ships it', () => {
    const load = jest.fn((name) => ({ from: name }));
    expect(loadConfigPlugins(load)).toEqual({ from: 'expo/config-plugins' });
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('falls back to @expo/config-plugins when expo is not installed', () => {
    const load = jest.fn((name) => {
      if (name === 'expo/config-plugins')
        throw Object.assign(new Error('nope'), { code: 'MODULE_NOT_FOUND' });
      return { from: name };
    });
    expect(loadConfigPlugins(load)).toEqual({ from: '@expo/config-plugins' });
    expect(load.mock.calls.map(([name]) => name)).toEqual([
      'expo/config-plugins',
      '@expo/config-plugins',
    ]);
  });
  it('rethrows any other failure from expo/config-plugins', () => {
    const load = () => {
      throw new Error('broken install');
    };
    expect(() => loadConfigPlugins(load)).toThrow('broken install');
  });
  it('resolves the real fallback in this repo, where expo is absent', () => {
    jest.resetModules();
    jest.doMock('expo/config-plugins', () => ({ marker: 'expo' }), {
      virtual: true,
    });
    expect(require('../lib/configPlugins').marker).toBe('expo');
    jest.dontMock('expo/config-plugins');
    jest.resetModules();
    const fallback = require('../lib/configPlugins');
    expect(fallback.marker).toBeUndefined();
    expect(typeof fallback.withInfoPlist).toBe('function');
  });
});
