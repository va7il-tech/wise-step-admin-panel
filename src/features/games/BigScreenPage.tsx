import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Loader2, Trophy, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';
import {
  GAME_EVENT,
  PLAYER_EVENT,
  gameChannelName,
  type HostBroadcast,
  type LeaderboardEntry,
  type LiveQuestion,
  type PresenceMeta,
} from '@/lib/types';
import { createBrandQr } from '@/lib/qr';
import { cn } from '@/lib/utils';
import { optionStyle } from './optionStyles';
import { CountdownRing } from './CountdownRing';
import { TallyBars } from './HostSessionPage';

/**
 * Big-screen / projector view (/screen/:sessionId).
 * Passive listener on the game channel — everything is sized to be read
 * from across a room. The admin keeps the management view on their own device.
 */

type ScreenState =
  | { kind: 'loading' }
  | { kind: 'lobby'; quizTitle?: string }
  | { kind: 'question'; index: number; total: number; question: LiveQuestion; endsAt: number; answered: number; totalPlayers: number }
  | { kind: 'reveal'; index: number; total: number; question: LiveQuestion | null; correctIndexes: number[]; tallies: number[]; leaderboard: LeaderboardEntry[] }
  | { kind: 'gameover'; podium: LeaderboardEntry[] };

export function BigScreenPage() {
  const { sessionId } = useParams();
  const [session, setSession] = useState<Tables<'game_sessions'> | null>(null);
  const [state, setState] = useState<ScreenState>({ kind: 'loading' });
  const [playerNames, setPlayerNames] = useState<string[]>([]);
  const lastQuestionRef = useRef<{ index: number; total: number; question: LiveQuestion } | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    void supabase
      .from('game_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()
      .then(({ data }) => setSession(data));
  }, [sessionId]);

  useEffect(() => {
    if (!session) return;
    const channel: RealtimeChannel = supabase.channel(gameChannelName(session.room_code));

    channel
      .on('broadcast', { event: GAME_EVENT }, ({ payload }) => {
        const msg = payload as HostBroadcast;
        switch (msg.type) {
          case 'lobby':
            setState({ kind: 'lobby', quizTitle: msg.quizTitle });
            break;
          case 'question':
            lastQuestionRef.current = {
              index: msg.index,
              total: msg.total,
              question: msg.question,
            };
            setState({
              kind: 'question',
              index: msg.index,
              total: msg.total,
              question: msg.question,
              endsAt: msg.endsAt,
              answered: 0,
              totalPlayers: 0,
            });
            break;
          case 'progress':
            setState((prev) =>
              prev.kind === 'question' && prev.index === msg.index
                ? { ...prev, answered: msg.answered, totalPlayers: msg.totalPlayers }
                : prev,
            );
            break;
          case 'reveal': {
            const last = lastQuestionRef.current;
            setState({
              kind: 'reveal',
              index: msg.index,
              total: last?.total ?? 0,
              question: last && last.index === msg.index ? last.question : null,
              correctIndexes: msg.correctIndexes,
              tallies: msg.tallies,
              leaderboard: msg.leaderboard,
            });
            break;
          }
          case 'gameover':
            setState({ kind: 'gameover', podium: msg.podium });
            break;
          case 'renamed':
            // Keep the standings in sync when the host renames someone mid-game.
            // The lobby list needs nothing — it comes from presence, which the player re-tracks.
            setState((prev) => {
              const rename = (entries: LeaderboardEntry[]) =>
                entries.map((e) =>
                  e.playerId === msg.playerId ? { ...e, nickname: msg.nickname } : e,
                );
              if (prev.kind === 'reveal') return { ...prev, leaderboard: rename(prev.leaderboard) };
              if (prev.kind === 'gameover') return { ...prev, podium: rename(prev.podium) };
              return prev;
            });
            break;
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const names = Object.values(channel.presenceState<PresenceMeta>())
          .flat()
          .map((meta) => meta.nickname)
          .filter(Boolean);
        setPlayerNames([...new Set(names)]);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Ask the host to re-broadcast current state.
          void channel.send({
            type: 'broadcast',
            event: PLAYER_EVENT,
            payload: { type: 'hello', playerId: 'big-screen', nickname: '' },
          });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session]);

  if (!session || state.kind === 'loading') {
    return (
      <Screen>
        <Loader2 size={48} className="animate-spin text-teal-400" />
        <p className="text-xl text-navy-200">Підключення до гри…</p>
      </Screen>
    );
  }

  const joinUrl = `${window.location.origin}/play/${session.room_code}`;

  if (state.kind === 'lobby') {
    return (
      <Screen>
        <div className="flex items-center gap-4">
          <img src="/logo.svg" alt="Wise Step" className="size-14 rounded-2xl" />
          <h1 className="text-4xl font-black text-white">{state.quizTitle ?? 'Wise Step Квіз'}</h1>
        </div>
        <div className="flex flex-col items-center gap-10 lg:flex-row lg:gap-16">
          <div className="flex flex-col items-center gap-4">
            <QrBlock url={joinUrl} />
            <p className="text-lg text-navy-200">{joinUrl}</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-xl text-navy-200">Код гри</p>
            <p className="text-8xl font-black tracking-[0.15em] text-teal-400">
              {session.room_code}
            </p>
          </div>
        </div>
        <div className="flex max-w-4xl flex-wrap items-center justify-center gap-3">
          <span className="inline-flex items-center gap-2 text-lg font-semibold text-navy-200">
            <Users size={22} /> {playerNames.length}
          </span>
          {playerNames.map((name) => (
            <span
              key={name}
              className="animate-pop-in rounded-full bg-white/10 px-5 py-2 text-xl font-bold text-white"
            >
              {name}
            </span>
          ))}
        </div>
      </Screen>
    );
  }

  if (state.kind === 'question') {
    return (
      <div className="flex min-h-dvh flex-col bg-navy-700 p-8 lg:p-14">
        <div className="mb-8 flex items-center justify-between">
          <span className="text-2xl font-bold text-navy-200">
            Питання {state.index + 1} / {state.total}
          </span>
          <CountdownRing endsAt={state.endsAt} totalSeconds={state.question.timeLimitSeconds} large />
        </div>
        <h1 className="mb-10 text-center text-4xl font-black leading-tight text-white lg:text-5xl">
          {state.question.text}
        </h1>
        <div className="grid flex-1 content-start gap-4 lg:grid-cols-2">
          {state.question.options.map((opt, i) => {
            const style = optionStyle(i);
            return (
              <div
                key={i}
                className={cn(
                  'flex min-h-24 items-center gap-4 rounded-2xl px-6 py-5 text-2xl font-bold text-white lg:text-3xl',
                  style.bg,
                )}
              >
                <style.icon size={30} fill="currentColor" className="shrink-0" />
                {opt}
              </div>
            );
          })}
        </div>
        <p className="mt-8 text-center text-2xl font-bold text-teal-300">
          Відповіли: {state.answered}
          {state.totalPlayers > 0 && ` з ${state.totalPlayers}`}
        </p>
      </div>
    );
  }

  if (state.kind === 'reveal') {
    return (
      <div className="flex min-h-dvh flex-col gap-10 bg-navy-700 p-8 lg:flex-row lg:p-14">
        <div className="flex-1">
          <p className="mb-3 text-xl font-bold text-navy-200">
            Питання {state.index + 1}
            {state.total ? ` / ${state.total}` : ''}
          </p>
          {state.question && (
            <h1 className="mb-8 text-3xl font-black leading-tight text-white">
              {state.question.text}
            </h1>
          )}
          <TallyBars
            options={state.question?.options ?? state.tallies.map((_, i) => `Варіант ${i + 1}`)}
            tallies={state.tallies}
            correctIndexes={state.correctIndexes}
            large
          />
        </div>
        <div className="w-full lg:w-96">
          <p className="mb-4 inline-flex items-center gap-2 text-2xl font-bold text-gold-500">
            <Trophy size={26} /> Лідери
          </p>
          <ol className="space-y-2">
            {state.leaderboard.slice(0, 5).map((entry, i) => (
              <li
                key={entry.playerId}
                className="flex items-center gap-4 rounded-2xl bg-white/10 px-5 py-3.5 text-xl text-white"
              >
                <span className="w-7 text-center font-black text-navy-200">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-bold">{entry.nickname}</span>
                {entry.lastGain > 0 && (
                  <span className="font-bold text-success-500">+{entry.lastGain}</span>
                )}
                <span className="font-black tabular-nums">{entry.score}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  // gameover — podium
  const [first, second, third] = state.podium;
  return (
    <Screen>
      <h1 className="text-5xl font-black text-white">🏆 Подіум</h1>
      <div className="flex items-end justify-center gap-6">
        {second && <ScreenPodiumStep entry={second} place={2} heightClass="h-40" />}
        {first && <ScreenPodiumStep entry={first} place={1} heightClass="h-56" />}
        {third && <ScreenPodiumStep entry={third} place={3} heightClass="h-28" />}
      </div>
      {state.podium.length > 3 && (
        <div className="flex max-w-3xl flex-wrap justify-center gap-3">
          {state.podium.slice(3, 10).map((entry, i) => (
            <span key={entry.playerId} className="rounded-full bg-white/10 px-5 py-2 text-lg font-bold text-white">
              {i + 4}. {entry.nickname} · {entry.score}
            </span>
          ))}
        </div>
      )}
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-10 bg-navy-700 p-8">
      {children}
    </div>
  );
}

function QrBlock({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = '';
    createBrandQr(url, 280).append(ref.current);
  }, [url]);
  return <div ref={ref} className="overflow-hidden rounded-3xl bg-white p-3" />;
}

const SCREEN_PLACE_STYLES: Record<number, { medal: string; bg: string }> = {
  1: { medal: '🥇', bg: 'bg-gold-500' },
  2: { medal: '🥈', bg: 'bg-mist-400' },
  3: { medal: '🥉', bg: 'bg-[#C9803B]' },
};

function ScreenPodiumStep({
  entry,
  place,
  heightClass,
}: {
  entry: LeaderboardEntry;
  place: number;
  heightClass: string;
}) {
  const style = SCREEN_PLACE_STYLES[place] ?? SCREEN_PLACE_STYLES[3]!;
  return (
    <div className="flex w-44 flex-col items-center gap-3">
      <span className="text-5xl">{style.medal}</span>
      <p className="w-full truncate text-center text-2xl font-black text-white">{entry.nickname}</p>
      <p className="text-lg font-bold text-navy-200">{entry.score}</p>
      <div
        className={cn(
          'flex w-full items-start justify-center rounded-t-2xl pt-3 text-3xl font-black text-white',
          style.bg,
          heightClass,
        )}
      >
        {place}
      </div>
    </div>
  );
}
