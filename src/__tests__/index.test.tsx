import { describe, expect, it } from '@jest/globals';

describe('package', () => {
  it('has the right name', () => {
    expect(require('../../package.json').name).toBe('react-native-wake-alarm');
  });
});
