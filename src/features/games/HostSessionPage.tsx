import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Flag,
  MonitorPlay,
  QrCode,
  Trophy,
  Users,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';
import {
  GAME_EVENT,
  PLAYER_EVENT,
  computeScore,
  gameChannelName,
  sameAnswerSet,
  type HostBroadcast,
  type LeaderboardEntry,
  type PlayerBroadcast,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge, Button, Card, PageHeader, Spinner } from '@/components/ui';
import { ShareModal } from '@/components/ShareModal';
import { optionStyle } from './optionStyles';
import { CountdownRing } from './CountdownRing';

type Session = Tables<'game_sessions'>;
type Quiz = Tables<'quizzes'>;
type Question = Tables<'quiz_questions'>;
type Player = Tables<'game_players'>;

type Phase = 'lobby' | 'question' | 'reveal' | 'gameover';

interface RecordedAnswer {
  selected: number[];
  elapsedMs: number;
}

export function HostSessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState<Session | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [phase, setPhase] = useState<Phase>('lobby');
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [tallies, setTallies] = useState<number[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Authoritative mutable state, kept in refs so realtime handlers never see stale closures.
  const channelRef = useRef<RealtimeChannel | null>(null);
  const phaseRef = useRef<Phase>('lobby');
  const indexRef = useRef(-1);
  const questionsRef = useRef<Question[]>([]);
  const playersRef = useRef<Player[]>([]);
  const answersRef = useRef<Map<string, RecordedAnswer>>(new Map());
  const scoresRef = useRef<Map<string, number>>(new Map());
  const lastGainsRef = useRef<Map<string, number>>(new Map());
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBroadcastRef = useRef<HostBroadcast | null>(null);

  const broadcast = useCallback((payload: HostBroadcast) => {
    lastBroadcastRef.current = payload;
    void channelRef.current?.send({ type: 'broadcast', event: GAME_EVENT, payload });
  }, []);

  const buildLeaderboard = useCallback((): LeaderboardEntry[] => {
    return playersRef.current
      .map((p) => ({
        playerId: p.id,
        nickname: p.nickname,
        score: scoresRef.current.get(p.id) ?? 0,
        lastGain: lastGainsRef.current.get(p.id) ?? 0,
      }))
      .sort((a, b) => b.score - a.score);
  }, []);

  const refreshPlayers = useCallback(async () => {
    if (!sessionId) return;
    const { data } = await supabase
      .from('game_players')
      .select('*')
      .eq('session_id', sessionId)
      .order('joined_at');
    if (data) {
      playersRef.current = data;
      setPlayers(data);
      for (const p of data) {
        if (!scoresRef.current.has(p.id)) scoresRef.current.set(p.id, p.score);
      }
    }
  }, [sessionId]);

  const reveal = useCallback(async () => {
    if (phaseRef.current !== 'question') return;
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    const question = questionsRef.current[indexRef.current];
    if (!question) return;

    phaseRef.current = 'reveal';
    setPhase('reveal');

    const options = Array.isArray(question.options) ? (question.options as string[]) : [];
    const newTallies = options.map(() => 0);
    lastGainsRef.current = new Map();

    const answerRows: Array<{
      session_id: string;
      player_id: string;
      question_id: string;
      selected_indexes: number[];
      is_correct: boolean;
      points_awarded: number;
    }> = [];

    for (const [playerId, answer] of answersRef.current) {
      for (const idx of answer.selected) {
        if (newTallies[idx] !== undefined) newTallies[idx] += 1;
      }
      const isCorrect = sameAnswerSet(answer.selected, question.correct_indexes);
      const gained = isCorrect
        ? computeScore(question.points, answer.elapsedMs, question.time_limit_seconds)
        : 0;
      lastGainsRef.current.set(playerId, gained);
      scoresRef.current.set(playerId, (scoresRef.current.get(playerId) ?? 0) + gained);
      answerRows.push({
        session_id: session?.id ?? '',
        player_id: playerId,
        question_id: question.id,
        selected_indexes: answer.selected,
        is_correct: isCorrect,
        points_awarded: gained,
      });
    }

    const board = buildLeaderboard();
    setTallies(newTallies);
    setLeaderboard(board);
    broadcast({
      type: 'reveal',
      index: indexRef.current,
      correctIndexes: question.correct_indexes,
      tallies: newTallies,
      leaderboard: board,
    });

    // Persist answers and scores (host is the only writer).
    if (answerRows.length > 0) {
      await supabase.from('game_answers').insert(answerRows);
      await Promise.all(
        answerRows.map((row) =>
          supabase
            .from('game_players')
            .update({ score: scoresRef.current.get(row.player_id) ?? 0 })
            .eq('id', row.player_id),
        ),
      );
    }
  }, [broadcast, buildLeaderboard, session?.id]);

  const showQuestion = useCallback(
    async (index: number) => {
      const question = questionsRef.current[index];
      if (!question || !session) return;
      indexRef.current = index;
      phaseRef.current = 'question';
      answersRef.current = new Map();
      setCurrentIndex(index);
      setPhase('question');
      setAnsweredCount(0);
      setTallies([]);

      const startedAt = Date.now();
      const questionEndsAt = startedAt + question.time_limit_seconds * 1000;
      setEndsAt(questionEndsAt);

      const options = Array.isArray(question.options) ? (question.options as string[]) : [];
      broadcast({
        type: 'question',
        index,
        total: questionsRef.current.length,
        question: {
          text: question.question_text,
          options,
          timeLimitSeconds: question.time_limit_seconds,
          points: question.points,
          multiple: question.correct_indexes.length > 1,
        },
        endsAt: questionEndsAt,
        startedAt,
      });

      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      // Small grace period for network latency before closing the question.
      revealTimerRef.current = setTimeout(
        () => void reveal(),
        question.time_limit_seconds * 1000 + 750,
      );

      await supabase
        .from('game_sessions')
        .update({ current_question_index: index })
        .eq('id', session.id);
    },
    [broadcast, reveal, session],
  );

  const startGame = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    await supabase
      .from('game_sessions')
      .update({ status: 'active', started_at: new Date().toISOString() })
      .eq('id', session.id);
    setSession({ ...session, status: 'active' });
    setBusy(false);
    await showQuestion(0);
  }, [session, showQuestion]);

  const finishGame = useCallback(async () => {
    if (!session) return;
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    phaseRef.current = 'gameover';
    setPhase('gameover');
    const board = buildLeaderboard();
    setLeaderboard(board);
    broadcast({ type: 'gameover', podium: board });
    await supabase.from('game_sessions').update({ status: 'finished' }).eq('id', session.id);
  }, [broadcast, buildLeaderboard, session]);

  const nextStep = useCallback(async () => {
    if (indexRef.current + 1 < questionsRef.current.length) {
      await showQuestion(indexRef.current + 1);
    } else {
      await finishGame();
    }
  }, [showQuestion, finishGame]);

  // Load session, quiz and questions
  useEffect(() => {
    if (!sessionId) return;
    void (async () => {
      const { data: sessionData } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      if (!sessionData) {
        navigate('/games', { replace: true });
        return;
      }
      const [{ data: quizData }, { data: questionData }] = await Promise.all([
        supabase.from('quizzes').select('*').eq('id', sessionData.quiz_id).single(),
        supabase
          .from('quiz_questions')
          .select('*')
          .eq('quiz_id', sessionData.quiz_id)
          .order('position'),
      ]);
      setSession(sessionData);
      setQuiz(quizData);
      questionsRef.current = questionData ?? [];
      setQuestions(questionData ?? []);
      if (sessionData.status === 'finished') {
        phaseRef.current = 'gameover';
        setPhase('gameover');
      }
      await refreshPlayers();
    })();
  }, [sessionId, navigate, refreshPlayers]);

  // Realtime channel
  useEffect(() => {
    if (!session || !quiz) return;
    const channel = supabase.channel(gameChannelName(session.room_code));
    channelRef.current = channel;

    channel
      .on('broadcast', { event: PLAYER_EVENT }, ({ payload }) => {
        const msg = payload as PlayerBroadcast;
        if (msg.type === 'hello') {
          void refreshPlayers();
          // Re-send current state so (re)connecting players/screens catch up.
          const last = lastBroadcastRef.current;
          if (last) {
            void channel.send({ type: 'broadcast', event: GAME_EVENT, payload: last });
          } else {
            broadcast({
              type: 'lobby',
              quizTitle: quiz.title,
              questionCount: questionsRef.current.length,
            });
          }
          return;
        }
        if (
          msg.type === 'answer' &&
          phaseRef.current === 'question' &&
          msg.questionIndex === indexRef.current &&
          !answersRef.current.has(msg.playerId)
        ) {
          const question = questionsRef.current[indexRef.current];
          if (!question) return;
          answersRef.current.set(msg.playerId, {
            selected: msg.selected,
            // Clamp to the time limit — never trust the client clock fully.
            elapsedMs: Math.min(Math.max(0, msg.elapsedMs), question.time_limit_seconds * 1000),
          });
          const answered = answersRef.current.size;
          setAnsweredCount(answered);
          broadcast({
            type: 'progress',
            index: indexRef.current,
            answered,
            totalPlayers: playersRef.current.length,
          });
          if (answered >= playersRef.current.length && playersRef.current.length > 0) {
            void reveal();
          }
        }
      })
      .on('presence', { event: 'sync' }, () => {
        void refreshPlayers();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && phaseRef.current === 'lobby') {
          broadcast({
            type: 'lobby',
            quizTitle: quiz.title,
            questionCount: questionsRef.current.length,
          });
        }
      });

    return () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, quiz?.id]);

  if (!session || !quiz) return <Spinner label="Завантаження гри…" />;

  const joinUrl = `${window.location.origin}/play/${session.room_code}`;
  const currentQuestion = questions[currentIndex];
  const options =
    currentQuestion && Array.isArray(currentQuestion.options)
      ? (currentQuestion.options as string[])
      : [];

  return (
    <div>
      <PageHeader
        title={quiz.title}
        subtitle={`Код кімнати: ${session.room_code}`}
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate('/games')}>
              <ArrowLeft size={16} /> До ігор
            </Button>
            <a
              href={`/screen/${session.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-mist-300 bg-white px-4 text-sm font-semibold text-navy-700 hover:bg-mist-100"
            >
              <MonitorPlay size={15} /> Великий екран
            </a>
            {phase !== 'gameover' && (
              <Button variant="danger" onClick={() => void finishGame()}>
                <Flag size={15} /> Завершити гру
              </Button>
            )}
          </>
        }
      />

      {phase === 'lobby' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-sm font-medium text-mist-600">Гравці приєднуються за кодом</p>
            <p className="text-5xl font-black tracking-[0.2em] text-navy-700">{session.room_code}</p>
            <p className="text-sm text-mist-600">
              або за посиланням <span className="font-medium text-teal-600">{joinUrl}</span>
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShareOpen(true)}>
                <QrCode size={16} /> QR-код
              </Button>
              <Button
                size="lg"
                onClick={() => void startGame()}
                loading={busy}
                disabled={players.length === 0}
                title={players.length === 0 ? 'Чекаємо на гравців' : undefined}
              >
                Почати гру <ChevronRight size={18} />
              </Button>
            </div>
          </Card>
          <Card>
            <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-navy-600">
              <Users size={16} className="text-teal-500" /> Гравці ({players.length})
            </p>
            {players.length === 0 ? (
              <p className="text-sm text-mist-600">
                Поки нікого — покажіть QR-код або продиктуйте код кімнати.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {players.map((p) => (
                  <span
                    key={p.id}
                    className="animate-pop-in rounded-full bg-navy-50 px-3 py-1.5 text-sm font-medium text-navy-700"
                  >
                    {p.nickname}
                  </span>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {phase === 'question' && currentQuestion && (
        <div className="space-y-4">
          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <Badge tone="teal">
                Питання {currentIndex + 1} / {questions.length}
              </Badge>
              {endsAt && <CountdownRing endsAt={endsAt} totalSeconds={currentQuestion.time_limit_seconds} />}
            </div>
            <h2 className="text-lg font-bold text-navy-700 sm:text-xl">
              {currentQuestion.question_text}
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {options.map((opt, i) => {
                const style = optionStyle(i);
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold text-white',
                      style.bg,
                    )}
                  >
                    <style.icon size={15} fill="currentColor" className="shrink-0" />
                    {opt}
                  </div>
                );
              })}
            </div>
          </Card>
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-mist-600">
              Відповіли: <span className="font-bold text-navy-700">{answeredCount}</span> з{' '}
              {players.length}
            </p>
            <Button variant="secondary" onClick={() => void reveal()}>
              Завершити питання зараз
            </Button>
          </Card>
        </div>
      )}

      {phase === 'reveal' && currentQuestion && (
        <div className="space-y-4">
          <Card className="space-y-4">
            <Badge tone="teal">
              Питання {currentIndex + 1} / {questions.length} — результати
            </Badge>
            <h2 className="text-lg font-bold text-navy-700">{currentQuestion.question_text}</h2>
            <TallyBars
              options={options}
              tallies={tallies}
              correctIndexes={currentQuestion.correct_indexes}
            />
            <div className="flex justify-end">
              <Button onClick={() => void nextStep()}>
                {currentIndex + 1 < questions.length ? (
                  <>
                    Наступне питання <ChevronRight size={16} />
                  </>
                ) : (
                  <>
                    <Trophy size={16} /> Показати подіум
                  </>
                )}
              </Button>
            </div>
          </Card>
          <LeaderboardCard entries={leaderboard.slice(0, 8)} />
        </div>
      )}

      {phase === 'gameover' && (
        <div className="space-y-4">
          <PodiumCard entries={leaderboard} />
          <div className="flex justify-center">
            <Link
              to="/games"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-navy-700 px-5 text-sm font-semibold text-white hover:bg-navy-600"
            >
              <ArrowLeft size={16} /> Повернутися до ігор
            </Link>
          </div>
        </div>
      )}

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        url={joinUrl}
        title={`Приєднатися до гри ${session.room_code}`}
        fileName={`wisestep-game-${session.room_code}`}
      />
    </div>
  );
}

export function TallyBars({
  options,
  tallies,
  correctIndexes,
  large,
}: {
  options: string[];
  tallies: number[];
  correctIndexes: number[];
  large?: boolean;
}) {
  const max = Math.max(1, ...tallies);
  return (
    <div className="space-y-2.5">
      {options.map((opt, i) => {
        const style = optionStyle(i);
        const count = tallies[i] ?? 0;
        const isCorrect = correctIndexes.includes(i);
        return (
          <div key={i} className="flex items-center gap-3">
            <span
              className={cn(
                'flex shrink-0 items-center justify-center rounded-lg text-white',
                large ? 'size-10' : 'size-8',
                style.bg,
              )}
            >
              <style.icon size={large ? 18 : 14} fill="currentColor" />
            </span>
            <div className="min-w-0 flex-1">
              <div className={cn('mb-1 flex items-center gap-2', large ? 'text-lg' : 'text-sm')}>
                <span
                  className={cn(
                    'truncate font-medium',
                    isCorrect ? 'text-success-700' : large ? 'text-white' : 'text-navy-700',
                  )}
                >
                  {opt}
                </span>
                {isCorrect && <Check size={large ? 20 : 15} className="shrink-0 text-success-500" strokeWidth={3} />}
              </div>
              <div className={cn('overflow-hidden rounded-full', large ? 'h-3 bg-white/15' : 'h-2 bg-mist-200')}>
                <div
                  className={cn('h-full rounded-full', isCorrect ? 'bg-success-500' : 'bg-mist-400')}
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </div>
            </div>
            <span className={cn('shrink-0 font-bold tabular-nums', large ? 'text-xl text-white' : 'text-sm text-navy-700')}>
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function LeaderboardCard({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <Card>
      <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-navy-600">
        <Trophy size={16} className="text-gold-600" /> Таблиця лідерів
      </p>
      <ol className="space-y-1.5">
        {entries.map((entry, i) => (
          <li
            key={entry.playerId}
            className="flex items-center gap-3 rounded-xl bg-mist-50 px-3.5 py-2.5 text-sm"
          >
            <span className="w-6 shrink-0 text-center font-bold text-mist-500">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate font-medium text-navy-700">
              {entry.nickname}
            </span>
            {entry.lastGain > 0 && (
              <span className="shrink-0 text-xs font-semibold text-success-500">
                +{entry.lastGain}
              </span>
            )}
            <span className="shrink-0 font-bold tabular-nums text-navy-700">{entry.score}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function PodiumCard({ entries }: { entries: LeaderboardEntry[] }) {
  const [first, second, third] = entries;
  const rest = entries.slice(3, 10);
  return (
    <Card className="py-8">
      <h2 className="mb-8 text-center text-2xl font-black text-navy-700">🏆 Подіум</h2>
      <div className="mx-auto flex max-w-md items-end justify-center gap-3">
        {second && <PodiumStep entry={second} place={2} heightClass="h-24" />}
        {first && <PodiumStep entry={first} place={1} heightClass="h-32" />}
        {third && <PodiumStep entry={third} place={3} heightClass="h-16" />}
      </div>
      {rest.length > 0 && (
        <ol className="mx-auto mt-8 max-w-md space-y-1.5">
          {rest.map((entry, i) => (
            <li
              key={entry.playerId}
              className="flex items-center gap-3 rounded-xl bg-mist-50 px-3.5 py-2 text-sm"
            >
              <span className="w-6 shrink-0 text-center font-bold text-mist-500">{i + 4}</span>
              <span className="min-w-0 flex-1 truncate font-medium text-navy-700">
                {entry.nickname}
              </span>
              <span className="shrink-0 font-bold tabular-nums text-navy-700">{entry.score}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

const PLACE_STYLES: Record<number, { medal: string; bg: string }> = {
  1: { medal: '🥇', bg: 'bg-gold-500' },
  2: { medal: '🥈', bg: 'bg-mist-400' },
  3: { medal: '🥉', bg: 'bg-[#C9803B]' },
};

function PodiumStep({
  entry,
  place,
  heightClass,
}: {
  entry: LeaderboardEntry;
  place: number;
  heightClass: string;
}) {
  const style = PLACE_STYLES[place] ?? PLACE_STYLES[3]!;
  return (
    <div className="flex w-28 flex-col items-center gap-2">
      <span className="text-3xl">{style.medal}</span>
      <p className="w-full truncate text-center text-sm font-bold text-navy-700">{entry.nickname}</p>
      <p className="text-xs font-semibold text-mist-600">{entry.score}</p>
      <div
        className={cn(
          'flex w-full items-start justify-center rounded-t-xl pt-2 text-lg font-black text-white',
          style.bg,
          heightClass,
        )}
      >
        {place}
      </div>
    </div>
  );
}
