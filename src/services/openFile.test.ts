import { Platform } from 'react-native';
import { openFile } from './openFile';

describe('openFile (web)', () => {
  it('lee un blob: con fetch', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    Object.defineProperty(global, 'fetch', {
      value: jest.fn().mockResolvedValue({ blob: async () => new Blob(['a,b']) }),
      configurable: true,
      writable: true,
    });
    const f = await openFile('blob:http://localhost/x');
    expect(f.size).toBe(3);
    expect(await f.text()).toBe('a,b');
  });
});
