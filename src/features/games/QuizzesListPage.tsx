import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gamepad2, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';
import { formatDate, generateRoomCode } from '@/lib/utils';
import { useAuth } from '@/features/auth/AuthContext';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  Spinner,
} from '@/components/ui';

type QuizRow = Tables<'quizzes'> & { quiz_questions: { count: number }[] };

export function QuizzesListPage() {
  const { canEdit } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<QuizRow[] | null>(null);
  const [liveSessions, setLiveSessions] = useState<Tables<'game_sessions'>[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<QuizRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: quizData }, { data: sessionData }] = await Promise.all([
      supabase
        .from('quizzes')
        .select('*, quiz_questions(count)')
        .order('created_at', { ascending: false }),
      supabase
        .from('game_sessions')
        .select('*')
        .in('status', ['lobby', 'active'])
        .order('created_at', { ascending: false }),
    ]);
    setQuizzes((quizData as QuizRow[] | null) ?? []);
    setLiveSessions(sessionData ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const questionCount = (quiz: QuizRow) => quiz.quiz_questions[0]?.count ?? 0;

  const startSession = async (quiz: QuizRow) => {
    setError(null);
    setStartingId(quiz.id);
    // Retry a few times in the (unlikely) case of a room-code collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error: insertError } = await supabase
        .from('game_sessions')
        .insert({ quiz_id: quiz.id, room_code: generateRoomCode() })
        .select('id')
        .single();
      if (data) {
        navigate(`/games/host/${data.id}`);
        return;
      }
      if (insertError && insertError.code !== '23505') break;
    }
    setStartingId(null);
    setError('Не вдалося створити гру. Спробуйте ще раз.');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from('quizzes').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    await load();
  };

  return (
    <div>
      <PageHeader
        title="Ігри"
        subtitle="Інтерактивні квізи для таборів та заходів"
        actions={
          canEdit && (
            <Button onClick={() => navigate('/games/new')}>
              <Plus size={16} /> Новий квіз
            </Button>
          )
        }
      />

      {error && (
        <p className="mb-4 rounded-xl bg-error-50 p-3 text-sm font-medium text-error-700">{error}</p>
      )}

      {liveSessions.length > 0 && (
        <Card className="mb-5 border border-teal-200 bg-teal-50/60">
          <p className="mb-2 text-sm font-semibold text-teal-700">Активні ігри</p>
          <div className="flex flex-wrap gap-2">
            {liveSessions.map((s) => (
              <button
                key={s.id}
                onClick={() => navigate(`/games/host/${s.id}`)}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-medium text-navy-700 shadow-card transition-shadow hover:shadow-card-hover"
              >
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-teal-500" />
                </span>
                Код {s.room_code}
                <Badge tone={s.status === 'lobby' ? 'mist' : 'teal'}>
                  {s.status === 'lobby' ? 'Лобі' : 'Триває'}
                </Badge>
              </button>
            ))}
          </div>
        </Card>
      )}

      {quizzes === null ? (
        <Spinner label="Завантаження квізів…" />
      ) : quizzes.length === 0 ? (
        <EmptyState
          icon={<Gamepad2 size={22} />}
          title="Квізів поки немає"
          description="Створіть перший квіз — наприклад, квіз-знайомство для табору."
          action={
            canEdit && (
              <Button onClick={() => navigate('/games/new')}>
                <Plus size={16} /> Створити квіз
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {quizzes.map((quiz) => (
            <Card key={quiz.id} className="flex flex-col gap-3 p-0 transition-shadow hover:shadow-card-hover">
              {quiz.cover_image ? (
                <img src={quiz.cover_image} alt="" className="h-32 w-full rounded-t-card object-cover" />
              ) : (
                <div className="flex h-32 w-full items-center justify-center rounded-t-card bg-navy-700">
                  <Gamepad2 size={32} className="text-teal-400" />
                </div>
              )}
              <div className="flex flex-1 flex-col gap-2 p-5 pt-1">
                <h3 className="font-semibold leading-snug text-navy-700">{quiz.title}</h3>
                <p className="text-xs text-mist-600">
                  {questionCount(quiz)} питань · {formatDate(quiz.created_at)}
                </p>
                <div className="mt-auto flex flex-wrap gap-2 border-t border-mist-100 pt-3">
                  {canEdit && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => void startSession(quiz)}
                        loading={startingId === quiz.id}
                        disabled={questionCount(quiz) === 0}
                        title={questionCount(quiz) === 0 ? 'Додайте хоча б одне питання' : undefined}
                      >
                        <Play size={14} /> Провести гру
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/games/${quiz.id}/edit`)}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => setDeleteTarget(quiz)}>
                        <Trash2 size={14} />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title="Видалити квіз?"
        message={`«${deleteTarget?.title}» та всі його питання буде видалено назавжди.`}
        loading={deleting}
      />
    </div>
  );
}
