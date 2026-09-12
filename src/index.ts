import { getNativeWakeAlarm } from './NativeWakeAlarm';
import { createApi } from './api';
import { registerRingRoot } from './ringScreen/registry';

export * from './types';
export { WakeAlarmInputError } from './validate';
export { DefaultRingScreen } from './ringScreen/DefaultRingScreen';
export { RING_COMPONENT_NAME } from './ringScreen/registry';

const WakeAlarm = createApi(getNativeWakeAlarm);
registerRingRoot(WakeAlarm);
export default WakeAlarm;
