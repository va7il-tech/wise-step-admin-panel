import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Check, Loader2, PartyPopper, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  GAME_EVENT,
  PLAYER_EVENT,
  gameChannelName,
  sameAnswerSet,
  type HostBroadcast,
  type LeaderboardEntry,
  type LiveQuestion,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { optionStyle } from './optionStyles';
import { CountdownRing } from './CountdownRing';

/**
 * Player screen (/play/:code) — nickname only, no account.
 * Built mobile-first: used live on phones at camps and events.
 */

type Stage =
  | { kind: 'enter-code' }
  | { kind: 'enter-nickname'; sessionId: string; roomCode: string }
  | { kind: 'closed'; message: string }
  | { kind: 'waiting'; quizTitle?: string }
  | { kind: 'question'; index: number; total: number; question: LiveQuestion; endsAt: number }
  | { kind: 'answered'; index: number }
  | {
      kind: 'result';
      correct: boolean;
      gained: number;
      score: number;
      rank: number;
      totalPlayers: number;
    }
  | { kind: 'podium'; rank: number; score: number; podium: LeaderboardEntry[] };

interface StoredPlayer {
  playerId: string;
  nickname: string;
  sessionId: string;
}

function storageKey(code: string) {
  return `wisestep-player-${code}`;
}

export function PlayPage() {
  const { code } = useParams();
  const navigate = useNavigate();

  const [stage, setStage] = useState<Stage>({ kind: 'enter-code' });
  const [codeInput, setCodeInput] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [checking, setChecking] = useState(Boolean(code));

  const channelRef = useRef<RealtimeChannel | null>(null);
  const playerRef = useRef<StoredPlayer | null>(null);
  const questionShownAtRef = useRef(0);
  const answeredIndexRef = useRef(-1);
  const lastSelectedRef = useRef<number[] | null>(null);
  const stageRef = useRef<Stage>(stage);
  stageRef.current = stage;

  /* ---------- Step 1: resolve the room code ---------- */
  useEffect(() => {
    if (!code) {
      setChecking(false);
      setStage({ kind: 'enter-code' });
      return;
    }
    void (async () => {
      setChecking(true);
      // Never strand a player on a spinner if the network hiccups.
      const { data: session } = await supabase
        .from('game_sessions')
        .select('id, status, room_code')
        .eq('room_code', code)
        .in('status', ['lobby', 'active'])
        .maybeSingle()
        .then(
          (res) => res,
          () => ({ data: null }),
        );
      setChecking(false);
      if (!session) {
        setError('Гру з таким кодом не знайдено. Перевірте код.');
        setStage({ kind: 'enter-code' });
        return;
      }
      const stored = sessionStorage.getItem(storageKey(code));
      if (stored) {
        // Rejoining after a refresh — reconnect with the same identity.
        playerRef.current = JSON.parse(stored) as StoredPlayer;
        setStage({ kind: 'waiting' });
        return;
      }
      if (session.status !== 'lobby') {
        setStage({ kind: 'closed', message: 'Гра вже почалася — приєднатися можна лише в лобі.' });
        return;
      }
      setStage({ kind: 'enter-nickname', sessionId: session.id, roomCode: session.room_code });
    })();
  }, [code]);

  /* ---------- Step 2: realtime channel once we have an identity ---------- */
  const connect = useCallback(
    (roomCode: string) => {
      const player = playerRef.current;
      if (!player || channelRef.current) return;
      const channel = supabase.channel(gameChannelName(roomCode));
      channelRef.current = channel;

      channel
        .on('broadcast', { event: GAME_EVENT }, ({ payload }) => {
          const msg = payload as HostBroadcast;
          const me = playerRef.current;
          if (!me) return;
          switch (msg.type) {
            case 'lobby':
              if (
                stageRef.current.kind === 'waiting' ||
                stageRef.current.kind === 'enter-nickname'
              ) {
                setStage({ kind: 'waiting', quizTitle: msg.quizTitle });
              }
              break;
            case 'question': {
              // Ignore re-broadcasts of a question we already answered.
              if (answeredIndexRef.current === msg.index) return;
              questionShownAtRef.current = Date.now();
              lastSelectedRef.current = null;
              setSelected([]);
              setStage({
                kind: 'question',
                index: msg.index,
                total: msg.total,
                question: msg.question,
                endsAt: msg.endsAt,
              });
              break;
            }
            case 'reveal': {
              const mine = msg.leaderboard.find((e) => e.playerId === me.playerId);
              const rank = msg.leaderboard.findIndex((e) => e.playerId === me.playerId) + 1;
              const myAnswer = lastSelectedRef.current;
              setStage({
                kind: 'result',
                correct: myAnswer !== null && sameAnswerSet(myAnswer, msg.correctIndexes),
                gained: mine?.lastGain ?? 0,
                score: mine?.score ?? 0,
                rank: rank || msg.leaderboard.length,
                totalPlayers: msg.leaderboard.length,
              });
              break;
            }
            case 'gameover': {
              const rank = msg.podium.findIndex((e) => e.playerId === me.playerId) + 1;
              const mine = msg.podium.find((e) => e.playerId === me.playerId);
              setStage({
                kind: 'podium',
                rank: rank || msg.podium.length,
                score: mine?.score ?? 0,
                podium: msg.podium.slice(0, 3),
              });
              break;
            }
            case 'progress':
              break;
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            void channel.track({ playerId: player.playerId, nickname: player.nickname });
            void channel.send({
              type: 'broadcast',
              event: PLAYER_EVENT,
              payload: { type: 'hello', playerId: player.playerId, nickname: player.nickname },
            });
          }
        });
    },
    [],
  );

  useEffect(() => {
    if (code && playerRef.current) connect(code);
    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, stage.kind === 'enter-code' || stage.kind === 'enter-nickname' ? 'idle' : 'live']);

  /* ---------- Actions ---------- */

  const join = async () => {
    if (stage.kind !== 'enter-nickname') return;
    const name = nickname.trim();
    if (!name) {
      setError('Введіть імʼя, яке побачать інші гравці');
      return;
    }
    setError(null);
    setJoining(true);
    const { data, error: joinError } = await supabase
      .from('game_players')
      .insert({ session_id: stage.sessionId, nickname: name.slice(0, 24) })
      .select('id')
      .single();
    setJoining(false);
    if (joinError || !data) {
      setError('Не вдалося приєднатися. Можливо, гра вже почалася.');
      return;
    }
    const player: StoredPlayer = { playerId: data.id, nickname: name, sessionId: stage.sessionId };
    playerRef.current = player;
    sessionStorage.setItem(storageKey(stage.roomCode), JSON.stringify(player));
    // The channel effect below reconnects now that we have an identity.
    setStage({ kind: 'waiting' });
  };

  const submitAnswer = (indexes: number[]) => {
    if (stage.kind !== 'question') return;
    const player = playerRef.current;
    if (!player) return;
    answeredIndexRef.current = stage.index;
    lastSelectedRef.current = indexes;
    void channelRef.current?.send({
      type: 'broadcast',
      event: PLAYER_EVENT,
      payload: {
        type: 'answer',
        playerId: player.playerId,
        nickname: player.nickname,
        questionIndex: stage.index,
        selected: indexes,
        elapsedMs: Date.now() - questionShownAtRef.current,
      },
    });
    setStage({ kind: 'answered', index: stage.index });
  };

  const toggleSelect = (i: number) => {
    setSelected((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  };

  /* ---------- Render ---------- */

  if (checking) {
    return (
      <Shell>
        <Loader2 size={32} className="animate-spin text-teal-400" />
      </Shell>
    );
  }

  if (stage.kind === 'enter-code') {
    return (
      <Shell>
        <img src="/logo.svg" alt="Wise Step" className="size-16 rounded-2xl" />
        <h1 className="text-xl font-bold text-white">Приєднатися до гри</h1>
        <form
          className="flex w-full flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const clean = codeInput.replace(/\D/g, '');
            if (clean.length >= 4) navigate(`/play/${clean}`);
          }}
        >
          <input
            value={codeInput}
            onChange={(e) => {
              setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6));
              setError(null);
            }}
            inputMode="numeric"
            autoFocus
            placeholder="Код гри"
            className="h-14 w-full rounded-2xl border-2 border-transparent bg-white text-center text-2xl font-black tracking-[0.3em] text-navy-700 placeholder:text-base placeholder:font-medium placeholder:tracking-normal placeholder:text-mist-500 focus:border-teal-400 focus:outline-none"
          />
          {error && <p className="text-center text-sm font-medium text-error-500">{error}</p>}
          <button
            type="submit"
            disabled={codeInput.length < 4}
            className="h-14 rounded-2xl bg-teal-500 text-lg font-bold text-white transition-colors hover:bg-teal-600 disabled:bg-white/10 disabled:text-white/40"
          >
            Увійти
          </button>
        </form>
      </Shell>
    );
  }

  if (stage.kind === 'enter-nickname') {
    return (
      <Shell>
        <img src="/logo.svg" alt="Wise Step" className="size-16 rounded-2xl" />
        <h1 className="text-xl font-bold text-white">Як вас звати?</h1>
        <form
          className="flex w-full flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void join();
          }}
        >
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={24}
            autoFocus
            placeholder="Ваше імʼя"
            className="h-14 w-full rounded-2xl border-2 border-transparent bg-white text-center text-xl font-bold text-navy-700 placeholder:text-base placeholder:font-medium placeholder:text-mist-500 focus:border-teal-400 focus:outline-none"
          />
          {error && <p className="text-center text-sm font-medium text-error-500">{error}</p>}
          <button
            type="submit"
            disabled={joining}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-teal-500 text-lg font-bold text-white transition-colors hover:bg-teal-600 disabled:opacity-60"
          >
            {joining && <Loader2 size={20} className="animate-spin" />}
            Грати!
          </button>
        </form>
      </Shell>
    );
  }

  if (stage.kind === 'closed') {
    return (
      <Shell>
        <p className="text-center text-lg font-semibold text-white">{stage.message}</p>
        <button
          onClick={() => navigate('/play')}
          className="rounded-2xl bg-white/10 px-6 py-3 font-semibold text-white hover:bg-white/20"
        >
          Ввести інший код
        </button>
      </Shell>
    );
  }

  if (stage.kind === 'waiting') {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="relative flex size-4">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal-400 opacity-75" />
            <span className="relative inline-flex size-4 rounded-full bg-teal-500" />
          </span>
          <h1 className="text-xl font-bold text-white">Ви в грі!</h1>
          {stage.quizTitle && <p className="text-navy-200">{stage.quizTitle}</p>}
          <p className="text-sm text-navy-300">
            {playerRef.current?.nickname} · чекаємо на початок…
          </p>
        </div>
      </Shell>
    );
  }

  if (stage.kind === 'question') {
    const { question } = stage;
    return (
      <div className="flex min-h-dvh flex-col bg-navy-700 p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-navy-200">
            {stage.index + 1} / {stage.total}
          </span>
          <CountdownRing endsAt={stage.endsAt} totalSeconds={question.timeLimitSeconds} large />
        </div>
        <h1 className="mb-5 text-center text-lg font-bold leading-snug text-white">
          {question.text}
        </h1>
        <div
          className={cn(
            'grid flex-1 content-start gap-3',
            question.options.length > 4 ? 'grid-cols-2' : 'grid-cols-1 min-[420px]:grid-cols-2',
          )}
        >
          {question.options.map((opt, i) => {
            const style = optionStyle(i);
            const isSelected = selected.includes(i);
            return (
              <button
                key={i}
                onClick={() => (question.multiple ? toggleSelect(i) : submitAnswer([i]))}
                className={cn(
                  'flex min-h-20 items-center gap-3 rounded-2xl p-4 text-left text-base font-bold text-white transition-transform active:scale-[0.97]',
                  style.bg,
                  question.multiple && isSelected && 'ring-4 ring-white',
                )}
              >
                <style.icon size={20} fill="currentColor" className="shrink-0" />
                <span className="min-w-0">{opt}</span>
                {question.multiple && isSelected && <Check size={20} className="ml-auto shrink-0" />}
              </button>
            );
          })}
        </div>
        {question.multiple && (
          <button
            onClick={() => submitAnswer([...selected].sort((a, b) => a - b))}
            disabled={selected.length === 0}
            className="mt-4 h-14 rounded-2xl bg-white text-lg font-bold text-navy-700 disabled:opacity-40"
          >
            Відповісти ({selected.length})
          </button>
        )}
      </div>
    );
  }

  if (stage.kind === 'answered') {
    return (
      <Shell>
        <Loader2 size={32} className="animate-spin text-teal-400" />
        <p className="text-lg font-semibold text-white">Відповідь прийнято!</p>
        <p className="text-sm text-navy-300">Чекаємо на інших гравців…</p>
      </Shell>
    );
  }

  if (stage.kind === 'result') {
    return (
      <div
        className={cn(
          'flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center',
          stage.correct ? 'bg-success-700' : 'bg-error-700',
        )}
      >
        <div className="flex size-20 items-center justify-center rounded-full bg-white/20">
          {stage.correct ? (
            <Check size={44} className="text-white" strokeWidth={3} />
          ) : (
            <X size={44} className="text-white" strokeWidth={3} />
          )}
        </div>
        <h1 className="text-2xl font-black text-white">
          {stage.correct ? 'Правильно!' : 'Не цього разу'}
        </h1>
        {stage.correct && <p className="text-xl font-bold text-white/90">+{stage.gained}</p>}
        <div className="mt-2 rounded-2xl bg-white/15 px-5 py-3 text-white">
          <p className="text-sm opacity-80">Ваше місце</p>
          <p className="text-xl font-bold">
            {stage.rank} з {stage.totalPlayers}
          </p>
          <p className="text-sm opacity-80">{stage.score} балів</p>
        </div>
      </div>
    );
  }

  // podium
  return (
    <Shell>
      <PartyPopper size={48} className="text-gold-500" />
      <h1 className="text-2xl font-black text-white">Гру завершено!</h1>
      <p className="text-lg font-bold text-teal-300">
        Ваше місце: {stage.rank} · {stage.score} балів
      </p>
      <div className="w-full space-y-2">
        {stage.podium.map((entry, i) => (
          <div
            key={entry.playerId}
            className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-white"
          >
            <span className="text-2xl">{['🥇', '🥈', '🥉'][i]}</span>
            <span className="min-w-0 flex-1 truncate font-bold">{entry.nickname}</span>
            <span className="font-bold tabular-nums">{entry.score}</span>
          </div>
        ))}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-navy-700 p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-5">{children}</div>
    </div>
  );
}
