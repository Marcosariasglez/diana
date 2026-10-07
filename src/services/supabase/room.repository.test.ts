import { RoomError } from '@/mocks/fakeSocket';

const mockRpc = jest.fn().mockResolvedValue({ data: null, error: null });
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    rpc: mockRpc,
    from: mockFrom,
    channel: jest.fn().mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    }),
    removeChannel: jest.fn(),
  }),
}));

jest.mock('@/store/useProfileStore', () => ({
  useProfileStore: {
    getState: () => ({ profile: { displayName: 'Test User' } }),
  },
}));

import { supabaseRoomRepository } from './room.repository';

describe('supabaseRoomRepository', () => {
  beforeEach(() => {
    mockRpc.mockClear();
    mockFrom.mockClear();
  });

  it('joinRoom normaliza el codigo y llama a join_room', async () => {
    mockFrom
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { host_id: 'h', phase: 'lobby', mood: null, deck: [] },
          error: null,
        }),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });
    await supabaseRoomRepository.joinRoom('x49b', { userId: 'u', name: 'Test' });
    expect(mockRpc).toHaveBeenCalledWith('join_room', { p_code: 'X49B', p_name: 'Test' });
  });

  it('confirmMood envia p_deck', async () => {
    await supabaseRoomRepository.confirmMood('X49B', 'u', [{ mediaType: 'movie', mediaId: 1 }]);
    expect(mockRpc).toHaveBeenCalledWith('confirm_mood', {
      p_code: 'X49B',
      p_deck: [{ mediaType: 'movie', mediaId: 1 }],
    });
  });

  it('setReady envia p_ready: true', async () => {
    await supabaseRoomRepository.setReady('X49B', 'u', true);
    expect(mockRpc).toHaveBeenCalledWith('set_ready', { p_code: 'X49B', p_ready: true });
  });

  it('joinRoom con error full lanza RoomError', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'full' } });
    await expect(supabaseRoomRepository.joinRoom('X', { userId: 'u', name: 'N' })).rejects.toThrow(RoomError);
  });

  it('joinRoom con error not-host lanza RoomError', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'not-host' } });
    await expect(supabaseRoomRepository.joinRoom('X', { userId: 'u', name: 'N' })).rejects.toThrow(RoomError);
  });
});
