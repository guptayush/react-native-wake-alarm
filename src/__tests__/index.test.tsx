import { describe, expect, it, jest } from '@jest/globals';
import { AppRegistry } from 'react-native';
import { act, create } from 'react-test-renderer';
import native from '../__mocks__/NativeWakeAlarm';

jest.mock('../NativeWakeAlarm');

describe('index', () => {
  it('registers WakeAlarmRing exactly once on import and exports the api', async () => {
    const spy = jest.spyOn(AppRegistry, 'registerComponent');
    const mod = await import('../index');
    const again = await import('../index');
    expect(again).toBe(mod);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0]).toBe(mod.RING_COMPONENT_NAME);
    expect(mod.RING_COMPONENT_NAME).toBe('WakeAlarmRing');
    expect(typeof mod.default.schedule).toBe('function');
    expect(typeof mod.DefaultRingScreen).toBe('function');
    expect(new mod.WakeAlarmInputError('f', 'm').code).toBe('invalid_input');

    mod.default.registerRingScreen(mod.DefaultRingScreen);
    expect(spy).toHaveBeenCalledTimes(1);

    native.getRingingJson.mockReturnValue(null);
    const Component = spy.mock.calls[0]![1]();
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<Component />);
    });
    expect(tree.toJSON()).toBeNull();
    act(() => {
      tree.unmount();
    });
    spy.mockRestore();
  });
});
