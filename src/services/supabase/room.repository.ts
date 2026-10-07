import type { GroupDecision, RoomSnapshot } from '@/types/room';
import { getSupabase } from '@/lib/supabase';
import { useProfileStore } from '@/store/useProfileStore';
import { RoomError } from '@/mocks/fakeSocket';
import type { RoomRepository } from '../room.repository';

const KNOWN = ['full', 'not-host', 'wrong-phase', 'not-found'] as const;

function toError(e: { message?: string } | null): Error {
  const m = e?.message ?? '';
  if ((KNOWN as readonly string[]).includes(m)) return new RoomError(m as (typeof KNOWN)[number]);
  return Object.assign(new Error(m || 'room-error'), { code: m });
}

async function rpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await getSupabase().rpc(fn, args);
  if (error) throw toError(error);
  return data;
}

async function fetchSnapshot(code: string): Promise<RoomSnapshot> {
  const sb = getSupabase();
  const [room, members] = await Promise.all([
    sb.from('rooms').select('host_id, phase, mood, deck').eq('code', code).single(),
    sb.from('room_members').select('user_id, name, is_ready, joined_at').eq('code', code).order('joined_at'),
  ]);
  if (room.error) throw new RoomError('not-found');
  if (members.error) throw toError(members.error);
  const mood = (room.data.mood ?? {}) as { answers?: Record<string, string>; confirmed?: boolean };
  return {
    hostId: room.data.host_id,
    phase: room.data.phase,
    mood: { answers: mood.answers ?? {}, confirmed: !!mood.confirmed },
    members: (members.data ?? []).map((m) => ({
      userId: m.user_id,
      name: m.name,
      initial: (m.name.trim()[0] ?? '?').toUpperCase(),
      isReady: m.is_ready,
    })),
    deck: (room.data.deck ?? []) as RoomSnapshot['deck'],
  };
}

export const supabaseRoomRepository: RoomRepository = {
  async createRoom() {
    const name = useProfileStore.getState().profile.displayName;
    return (await rpc('create_room', { p_name: name })) as string;
  },
  async joinRoom(code, user) {
    const c = code.trim().toUpperCase();
    await rpc('join_room', { p_code: c, p_name: user.name });
    return fetchSnapshot(c);
  },
  async setReady(code, _userId, ready) { await rpc('set_ready', { p_code: code, p_ready: ready }); },
  async startMatch(code) { await rpc('start_match', { p_code: code }); },
  async setMoodAnswer(code, _userId, questionId, answerId) {
    await rpc('set_mood_answer', { p_code: code, p_question: questionId, p_answer: answerId });
  },
  async confirmMood(code, _userId, deck) { await rpc('confirm_mood', { p_code: code, p_deck: deck ?? [] }); },
  async submitDecision(code, _userId, key, decision) {
    await rpc('submit_decision', { p_code: code, p_key: key, p_decision: decision });
  },
  async backToLobby(code) { await rpc('back_to_lobby', { p_code: code }); },
  leaveRoom(code) { void rpc('leave_room', { p_code: code }).catch(() => {}); },
  async getGroupSeenKeys(code) { return ((await rpc('group_seen_keys', { p_code: code })) ?? []) as string[]; },

  subscribe(code, cb) {
    const sb = getSupabase();
    let seq = 0;
    const refetch = () => {
      const mine = ++seq;
      fetchSnapshot(code).then((s) => { if (mine === seq) cb(s); }).catch(() => {});
    };
    const channel = sb
      .channel(`room:${code}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `code=eq.${code}` }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `code=eq.${code}` }, refetch)
      .subscribe((status) => { if (status === 'SUBSCRIBED') refetch(); });
    return () => { void sb.removeChannel(channel); };
  },
  subscribeDecisions(code, cb) {
    const sb = getSupabase();
    const emit = (p: { new: Record<string, unknown> }) => {
      const r = p.new as { user_id: string; key: string; decision: 'like' | 'skip' };
      cb({ userId: r.user_id, key: r.key, decision: r.decision } satisfies GroupDecision);
    };
    const channel = sb
      .channel(`decisions:${code}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_decisions', filter: `code=eq.${code}` }, emit)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'room_decisions', filter: `code=eq.${code}` }, emit)
      .subscribe();
    return () => { void sb.removeChannel(channel); };
  },
};
