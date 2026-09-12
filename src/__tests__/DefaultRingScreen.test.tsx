import { describe, expect, it, jest } from '@jest/globals';
import { Text } from 'react-native';
import { act, create } from 'react-test-renderer';
import { DefaultRingScreen } from '../ringScreen/DefaultRingScreen';

describe('DefaultRingScreen', () => {
  it('shows title, body, time and calls stop', async () => {
    const stop = jest.fn(async () => {});
    const alarm = {
      id: 'a',
      title: 'Wake up',
      body: 'Class in 15 min',
      firedAt: Date.UTC(2026, 0, 1, 6, 30),
      scheduledFor: Date.UTC(2026, 0, 1, 6, 30),
    };
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<DefaultRingScreen alarm={alarm} stop={stop} />);
    });
    const texts = tree.root.findAllByType(Text).map((t) => t.props.children);
    expect(texts).toContain('Wake up');
    expect(texts).toContain('Class in 15 min');
    await act(async () => {
      await tree.root
        .findByProps({ accessibilityRole: 'button' })
        .props.onPress();
    });
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('renders without a body', () => {
    const alarm = { id: 'a', title: 'Wake up', firedAt: 0, scheduledFor: 0 };
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<DefaultRingScreen alarm={alarm} stop={async () => {}} />);
    });
    expect(
      tree.root.findAllByType(Text).map((t) => t.props.children)
    ).not.toContain(undefined);
  });
});
