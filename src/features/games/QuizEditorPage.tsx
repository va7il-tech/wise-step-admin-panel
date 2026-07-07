import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, Check, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/lib/database.types';
import { randomId, cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/AuthContext';
import { Button, Card, Field, Input, PageHeader, Select, Spinner } from '@/components/ui';
import { ImageUpload } from '@/components/ImageUpload';
import { optionStyle } from './optionStyles';

interface EditableQuestion {
  /** Local key; DB ids are regenerated on save */
  key: string;
  question_text: string;
  options: string[];
  correct_indexes: number[];
  time_limit_seconds: number;
  points: number;
}

const TIME_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120];
const POINT_OPTIONS = [0, 500, 1000, 1500, 2000];

function newQuestion(): EditableQuestion {
  return {
    key: randomId(),
    question_text: '',
    options: ['', ''],
    correct_indexes: [],
    time_limit_seconds: 20,
    points: 1000,
  };
}

export function QuizEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit, session } = useAuth();
  const isNew = !id;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [questions, setQuestions] = useState<EditableQuestion[]>([newQuestion()]);

  useEffect(() => {
    if (!canEdit) navigate('/games', { replace: true });
  }, [canEdit, navigate]);

  useEffect(() => {
    if (isNew) return;
    void (async () => {
      const [{ data: quiz }, { data: dbQuestions }] = await Promise.all([
        supabase.from('quizzes').select('*').eq('id', id).single(),
        supabase.from('quiz_questions').select('*').eq('quiz_id', id).order('position'),
      ]);
      if (quiz) {
        setTitle(quiz.title);
        setCoverImage(quiz.cover_image);
      }
      if (dbQuestions && dbQuestions.length > 0) {
        setQuestions(
          dbQuestions.map((q) => ({
            key: q.id,
            question_text: q.question_text,
            options: Array.isArray(q.options) ? (q.options as string[]) : [],
            correct_indexes: q.correct_indexes,
            time_limit_seconds: q.time_limit_seconds,
            points: q.points,
          })),
        );
      }
      setLoading(false);
    })();
  }, [id, isNew]);

  const updateQuestion = (key: string, patch: Partial<EditableQuestion>) => {
    setQuestions((prev) => prev.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  };

  const moveQuestion = (index: number, dir: -1 | 1) => {
    setQuestions((prev) => {
      const next = [...prev];
      const a = next[index];
      const b = next[index + dir];
      if (!a || !b) return prev;
      next[index] = b;
      next[index + dir] = a;
      return next;
    });
  };

  const toggleCorrect = (q: EditableQuestion, optionIndex: number) => {
    const set = new Set(q.correct_indexes);
    if (set.has(optionIndex)) set.delete(optionIndex);
    else set.add(optionIndex);
    updateQuestion(q.key, { correct_indexes: [...set].sort((a, b) => a - b) });
  };

  const save = async () => {
    setError(null);
    if (!title.trim()) return setError('Вкажіть назву квізу');
    for (const [i, q] of questions.entries()) {
      const filledOptions = q.options.filter((o) => o.trim());
      if (!q.question_text.trim()) return setError(`Питання ${i + 1}: вкажіть текст питання`);
      if (filledOptions.length < 2) return setError(`Питання ${i + 1}: потрібно щонайменше 2 варіанти`);
      const validCorrect = q.correct_indexes.filter((ci) => q.options[ci]?.trim());
      if (validCorrect.length === 0)
        return setError(`Питання ${i + 1}: позначте хоча б одну правильну відповідь`);
    }
    setSaving(true);

    let quizId = id;
    if (isNew) {
      const { data, error: quizError } = await supabase
        .from('quizzes')
        .insert({ title: title.trim(), cover_image: coverImage, created_by: session?.user.id ?? null })
        .select('id')
        .single();
      if (quizError || !data) {
        setSaving(false);
        return setError(quizError?.message ?? 'Не вдалося зберегти квіз');
      }
      quizId = data.id;
    } else {
      const { error: quizError } = await supabase
        .from('quizzes')
        .update({ title: title.trim(), cover_image: coverImage })
        .eq('id', id);
      if (quizError) {
        setSaving(false);
        return setError(quizError.message);
      }
      // Replace-all strategy keeps positions/indexes consistent without diffing.
      await supabase.from('quiz_questions').delete().eq('quiz_id', id);
    }

    // Compact options and remap correct indexes to the compacted list.
    const rows = questions.map((q, position) => {
      const kept = q.options
        .map((text, originalIndex) => ({ text: text.trim(), originalIndex }))
        .filter((o) => o.text);
      const indexMap = new Map(kept.map((o, newIndex) => [o.originalIndex, newIndex]));
      return {
        quiz_id: quizId!,
        question_text: q.question_text.trim(),
        options: kept.map((o) => o.text) as unknown as Json,
        correct_indexes: q.correct_indexes
          .filter((ci) => indexMap.has(ci))
          .map((ci) => indexMap.get(ci)!),
        time_limit_seconds: q.time_limit_seconds,
        points: q.points,
        position,
      };
    });
    const { error: questionsError } = await supabase.from('quiz_questions').insert(rows);
    setSaving(false);
    if (questionsError) return setError(questionsError.message);
    navigate('/games');
  };

  if (loading) return <Spinner label="Завантаження квізу…" />;

  return (
    <div>
      <PageHeader
        title={isNew ? 'Новий квіз' : 'Редагування квізу'}
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate('/games')}>
              <ArrowLeft size={16} /> Назад
            </Button>
            <Button onClick={() => void save()} loading={saving}>
              Зберегти квіз
            </Button>
          </>
        }
      />

      {error && (
        <p className="mb-4 rounded-xl bg-error-50 p-3 text-sm font-medium text-error-700">{error}</p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          {questions.map((q, qIndex) => (
            <Card key={q.key} className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-teal-600">
                  Питання {qIndex + 1}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveQuestion(qIndex, -1)}
                    disabled={qIndex === 0}
                    className="rounded-lg p-1.5 text-mist-600 hover:bg-mist-100 disabled:opacity-30"
                    aria-label="Вгору"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveQuestion(qIndex, 1)}
                    disabled={qIndex === questions.length - 1}
                    className="rounded-lg p-1.5 text-mist-600 hover:bg-mist-100 disabled:opacity-30"
                    aria-label="Вниз"
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestions((prev) => prev.filter((x) => x.key !== q.key))}
                    disabled={questions.length === 1}
                    className="rounded-lg p-1.5 text-error-500 hover:bg-error-50 disabled:opacity-30"
                    aria-label="Видалити питання"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <Field label="Текст питання" required>
                <Input
                  value={q.question_text}
                  placeholder="У якому місті знаходиться Wise Step?"
                  onChange={(e) => updateQuestion(q.key, { question_text: e.target.value })}
                />
              </Field>

              <div className="space-y-2">
                <p className="text-sm font-medium text-navy-600">
                  Варіанти відповідей{' '}
                  <span className="font-normal text-mist-600">
                    (позначте правильні галочкою)
                  </span>
                </p>
                {q.options.map((opt, optIndex) => {
                  const style = optionStyle(optIndex);
                  const isCorrect = q.correct_indexes.includes(optIndex);
                  return (
                    <div key={optIndex} className="flex items-center gap-2">
                      <span
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-lg text-white',
                          style.bg,
                        )}
                      >
                        <style.icon size={15} fill="currentColor" />
                      </span>
                      <Input
                        value={opt}
                        placeholder={`Варіант ${optIndex + 1}`}
                        onChange={(e) => {
                          const options = [...q.options];
                          options[optIndex] = e.target.value;
                          updateQuestion(q.key, { options });
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => toggleCorrect(q, optIndex)}
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
                          isCorrect
                            ? 'border-success-500 bg-success-500 text-white'
                            : 'border-mist-300 text-mist-400 hover:border-success-500 hover:text-success-500',
                        )}
                        aria-label={isCorrect ? 'Правильна відповідь' : 'Позначити правильною'}
                        aria-pressed={isCorrect}
                      >
                        <Check size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const options = q.options.filter((_, i) => i !== optIndex);
                          updateQuestion(q.key, {
                            options,
                            correct_indexes: q.correct_indexes
                              .filter((ci) => ci !== optIndex)
                              .map((ci) => (ci > optIndex ? ci - 1 : ci)),
                          });
                        }}
                        disabled={q.options.length <= 2}
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-mist-400 hover:bg-error-50 hover:text-error-500 disabled:opacity-30"
                        aria-label="Видалити варіант"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
                {q.options.length < 6 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => updateQuestion(q.key, { options: [...q.options, ''] })}
                  >
                    <Plus size={14} /> Додати варіант
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Час на відповідь">
                  <Select
                    value={q.time_limit_seconds}
                    onChange={(e) =>
                      updateQuestion(q.key, { time_limit_seconds: Number(e.target.value) })
                    }
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t} с
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Бали">
                  <Select
                    value={q.points}
                    onChange={(e) => updateQuestion(q.key, { points: Number(e.target.value) })}
                  >
                    {POINT_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </Card>
          ))}

          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setQuestions((prev) => [...prev, newQuestion()])}
          >
            <Plus size={16} /> Додати питання
          </Button>
        </div>

        <div className="space-y-4">
          <Card className="space-y-4">
            <Field label="Назва квізу" required>
              <Input
                value={title}
                placeholder="Квіз-знайомство для табору"
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field label="Обкладинка">
              <ImageUpload value={coverImage} onChange={setCoverImage} folder="quiz-covers" />
            </Field>
          </Card>
          <Card className="text-sm text-mist-600">
            <p className="mb-1 font-semibold text-navy-600">Підказка</p>
            <p>
              Якщо позначити кілька правильних відповідей, гравець має обрати їх усі, щоб отримати
              бали. Швидші відповіді приносять більше балів.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
