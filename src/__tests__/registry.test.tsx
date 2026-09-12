import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AppRegistry, Text } from 'react-native';
import { act, create } from 'react-test-renderer';
import native, { emit } from '../__mocks__/NativeWakeAlarm';
import { createApi } from '../api';
import {
  __resetCurrentForTests,
  getRegisteredRingScreen,
} from '../ringScreen/current';
import { DefaultRingScreen } from '../ringScreen/DefaultRingScreen';
import { registerRingRoot, RING_COMPONENT_NAME } from '../ringScreen/registry';
import { RingRoot } from '../ringScreen/RingRoot';
import type { RingScreenProps } from '../types';

jest.mock('../NativeWakeAlarm');
const api = createApi(() => native);
const ringing = '{"id":"a","title":"Wake","firedAt":5,"scheduledFor":4}';

describe('registry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetCurrentForTests();
  });

  it('registerRingRoot registers WakeAlarmRing with a provider that renders RingRoot', () => {
    native.getRingingJson.mockReturnValue(null);
    const spy = jest.spyOn(AppRegistry, 'registerComponent');
    registerRingRoot(api);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0]).toBe(RING_COMPONENT_NAME);
    const Component = spy.mock.calls[0]![1]();
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<Component />);
    });
    expect(tree.toJSON()).toBeNull();
    spy.mockRestore();
  });

  it('registerRingScreen swaps the inner component without touching AppRegistry', () => {
    const Custom = (_p: RingScreenProps) => <Text>custom</Text>;
    const spy = jest.spyOn(AppRegistry, 'registerComponent');
    expect(getRegisteredRingScreen()).toBe(DefaultRingScreen);
    api.registerRingScreen(Custom);
    expect(getRegisteredRingScreen()).toBe(Custom);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('none of the api calls register with AppRegistry', () => {
    const spy = jest.spyOn(AppRegistry, 'registerComponent');
    native.getRingingJson.mockReturnValue(null);
    native.consumePendingActionJson.mockReturnValue(null);
    api.getRinging();
    api.consumePendingAction();
    api.addListener('fired', () => {}).remove();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('RingRoot renders the registered screen with the ringing alarm and stops via api', async () => {
    native.getRingingJson.mockReturnValue(ringing);
    native.stopRinging.mockResolvedValue(undefined);
    const Custom = ({ alarm, stop }: RingScreenProps) => (
      <Text onPress={stop}>{alarm.title}</Text>
    );
    api.registerRingScreen(Custom);
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<RingRoot api={api} />);
    });
    expect(tree.root.findByType(Text).props.children).toBe('Wake');
    await act(async () => {
      await tree.root.findByType(Text).props.onPress();
    });
    expect(native.stopRinging).toHaveBeenCalledTimes(1);
    act(() => {
      tree.unmount();
    });
  });

  it('RingRoot renders nothing when no alarm is ringing and clears on stopped event', () => {
    native.getRingingJson.mockReturnValue(ringing);
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<RingRoot api={api} />);
    });
    expect(tree.toJSON()).not.toBeNull();
    native.getRingingJson.mockReturnValue(null);
    act(() => {
      emit('onStopped', { id: 'a', at: 9, source: 'user' });
    });
    expect(tree.toJSON()).toBeNull();
    act(() => {
      tree = create(<RingRoot api={api} />);
    });
    expect(tree.toJSON()).toBeNull();
  });

  it('a fired event with a different ringing alarm re-renders the new title', () => {
    native.getRingingJson.mockReturnValue(ringing);
    const Custom = ({ alarm }: RingScreenProps) => <Text>{alarm.title}</Text>;
    api.registerRingScreen(Custom);
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<RingRoot api={api} />);
    });
    expect(tree.root.findByType(Text).props.children).toBe('Wake');
    native.getRingingJson.mockReturnValue(
      '{"id":"b","title":"Second","firedAt":10,"scheduledFor":10}'
    );
    act(() => {
      emit('onFired', { id: 'b', at: 10 });
    });
    expect(tree.root.findByType(Text).props.children).toBe('Second');
  });
});
