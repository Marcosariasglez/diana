import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RoomError } from '@/services/room.errors';

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

  it('createRoom llama a create_room con p_name Y p_affinity (migración 0012)', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'X49B', error: null });
    await supabaseRoomRepository.createRoom('u', 'express');
    expect(mockRpc).toHaveBeenCalledWith('create_room', { p_name: 'Test User', p_affinity: 'express' });
  });

  it('createRoom sin afinidad explicita pasa p_affinity intermedio (default 0012)', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'X49B', error: null });
    await supabaseRoomRepository.createRoom('u');
    expect(mockRpc).toHaveBeenCalledWith('create_room', { p_name: 'Test User', p_affinity: 'intermedio' });
  });

  it('la firma del RPC coincide con el SQL 0012 (create_room p_name, p_affinity default intermedio)', () => {
    // Lección del plan 2: el test lee el fichero de la migración y compara con
    // lo que el cliente envía, para que un cambio de firma en el SQL rompa aquí.
    const sql = readFileSync(
      join(__dirname, '..', '..', '..', 'supabase', 'migrations', '0012_room_affinity.sql'),
      'utf8',
    );
    const m = sql.match(/create function public\.create_room\(([^)]*)\)/);
    expect(m).not.toBeNull();
    const params = (m as RegExpMatchArray)[1]
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    // p_name (sin default) y p_affinity (default 'intermedio'), en ese orden.
    expect(params[0]).toMatch(/^p_name text$/);
    expect(params[1]).toMatch(/^p_affinity text default 'intermedio'$/);
    // Lo que el cliente envía (ver test anterior): p_name + p_affinity.
    mockRpc.mockClear();
    mockRpc.mockResolvedValueOnce({ data: 'X49B', error: null });
    void supabaseRoomRepository.createRoom('u', 'cinefilo');
    const args = mockRpc.mock.calls[0][1] as Record<string, string>;
    expect(Object.keys(args).sort()).toEqual(['p_affinity', 'p_name']);
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
