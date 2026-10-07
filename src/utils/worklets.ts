/**
 * Bridge from UI thread (worklet) to JS thread.
 *
 * In Reanimated 4 / Worklets 0.10 `runOnJS` is deprecated in favour of
 * `scheduleOnRN` (react-native-worklets). This module is the single place
 * that knows about it; callers keep using `toJS(fn)(...args)`.
 */
import { scheduleOnRN } from 'react-native-worklets';

/**
 * Adapt a JS function so it can be called from a worklet.
 * The returned wrapper runs on the UI thread and schedules the real call
 * on the JS thread. Both `toJS` and the wrapper are worklets so they can be
 * invoked from gesture and animation callbacks.
 */
export function toJS<T extends (...args: never[]) => void>(
  fn: T,
): (...args: Parameters<T>) => void {
  'worklet';
  return (...args: Parameters<T>) => {
    'worklet';
    scheduleOnRN(fn as (...a: Parameters<T>) => void, ...args);
  };
}
