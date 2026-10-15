/**
 * Demo-only bot players. A portfolio visitor usually has one tab and no second device, so when a
 * host opens a game room a handful of bots join the lobby and answer questions over the same
 * realtime protocol a real phone would use (see PlayerBroadcast in lib/types.ts).
 */
import {
  GAME_EVENT,
  PLAYER_EVENT,
  gameChannelName,
  type HostBroadcast,
  type PlayerBroadcast,
} from '@/lib/types';
import { DemoChannel } from './realtime';
import { loadDb, saveDb } from './db';

const BOT_NAMES = [
  'Софійка 🦊', 'Марко', 'Даринка', 'Тарас 🚀', 'Злата', 'Богдан', 'Ліза ⭐', 'Остап', 'Мирослава', 'Назар 🐻',
];
const BOT_COUNT = 4;

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function sessionStatus(sessionId: string) {
  return loadDb().game_sessions.find((s) => s.id === sessionId)?.status;
}

function pickAnswer(sessionId: string, index: number, optionCount: number, multiple: boolean, skill: number) {
  const db = loadDb();
  const session = db.game_sessions.find((s) => s.id === sessionId);
  const question = db.quiz_questions
    .filter((q) => q.quiz_id === session?.quiz_id)
    .sort((a, b) => a.position - b.position)[index];
  const correct = question?.correct_indexes ?? [0];
  if (Math.random() < skill) return [...correct];
  const wrong = Array.from({ length: optionCount }, (_, i) => i).filter((i) => !correct.includes(i));
  const oneWrong = wrong.slice(Math.floor(Math.random() * wrong.length)).slice(0, 1);
  // Multi-answer misses are plausible near-misses: one right option plus a wrong one.
  return multiple ? [...correct.slice(0, 1), ...oneWrong] : oneWrong.length ? oneWrong : [0];
}

function runBot(sessionId: string, roomCode: string, nickname: string) {
  if (sessionStatus(sessionId) !== 'lobby') return;

  const db = loadDb();
  const playerId = crypto.randomUUID();
  db.game_players.push({ id: playerId, session_id: sessionId, nickname, score: 0, joined_at: new Date().toISOString() });
  saveDb(db);

  let name = nickname;
  let answeredIndex = -1;
  const skill = 0.45 + Math.random() * 0.45;
  const channel = new DemoChannel(gameChannelName(roomCode));

  const send = (payload: PlayerBroadcast) =>
    void channel.send({ type: 'broadcast', event: PLAYER_EVENT, payload });

  channel
    .on('broadcast', { event: GAME_EVENT }, ({ payload }: { payload: HostBroadcast }) => {
      const msg = payload;
      if (msg.type === 'renamed' && msg.playerId === playerId) {
        name = msg.nickname;
        void channel.track({ playerId, nickname: name });
      }
      if (msg.type === 'question' && msg.index > answeredIndex) {
        answeredIndex = msg.index;
        const windowMs = Math.max(1500, msg.endsAt - Date.now());
        const delay = 1200 + Math.random() * Math.min(windowMs * 0.7, 9000);
        setTimeout(() => {
          send({
            type: 'answer',
            playerId,
            nickname: name,
            questionIndex: msg.index,
            selected: pickAnswer(sessionId, msg.index, msg.question.options.length, msg.question.multiple, skill),
            elapsedMs: Date.now() - msg.startedAt,
          });
        }, delay);
      }
      if (msg.type === 'gameover') setTimeout(() => void channel.unsubscribe(), 2000);
    })
    .subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      void channel.track({ playerId, nickname: name });
      send({ type: 'hello', playerId, nickname: name });
    });
}

/** Staggered joins so the lobby visibly fills up while the host is watching. */
export function spawnBots(sessionId: string, roomCode: string): void {
  shuffle(BOT_NAMES)
    .slice(0, BOT_COUNT)
    .forEach((nickname, i) => setTimeout(() => runBot(sessionId, roomCode, nickname), 1800 + i * 1700));
}
