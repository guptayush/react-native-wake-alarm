import NativeWakeAlarm from './NativeWakeAlarm';
import { createApi } from './api';

export * from './types';
export { WakeAlarmInputError } from './validate';
export { DefaultRingScreen } from './ringScreen/DefaultRingScreen';
export { RING_COMPONENT_NAME } from './ringScreen/registry';

const WakeAlarm = createApi(NativeWakeAlarm);
export default WakeAlarm;
