import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Plus,
  Trash2,
  Type,
  Mail,
  Phone,
  Hash,
  AlignLeft,
  ChevronDown,
  CircleDot,
  CheckSquare,
  Calendar,
  Paperclip,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  DEFAULT_FORM_STYLE,
  parseFormSchema,
  parseFormStyle,
  type FormField,
  type FormFieldType,
  type FormStyle,
} from '@/lib/types';
import type { Json } from '@/lib/database.types';
import { randomId, slugify } from '@/lib/utils';
import { useAuth } from '@/features/auth/AuthContext';
import { Button, Card, Field, Input, PageHeader, Spinner, Textarea } from '@/components/ui';
import { ImageUpload } from '@/components/ImageUpload';
import { AttachmentUpload } from '@/components/AttachmentUpload';

const FIELD_TYPES: Array<{ type: FormFieldType; label: string; icon: typeof Type }> = [
  { type: 'text', label: 'Текст', icon: Type },
  { type: 'email', label: 'Ел. пошта', icon: Mail },
  { type: 'phone', label: 'Телефон', icon: Phone },
  { type: 'number', label: 'Число', icon: Hash },
  { type: 'textarea', label: 'Багаторядковий текст', icon: AlignLeft },
  { type: 'select', label: 'Випадний список', icon: ChevronDown },
  { type: 'radio', label: 'Один із варіантів', icon: CircleDot },
  { type: 'checkbox', label: 'Кілька варіантів', icon: CheckSquare },
  { type: 'date', label: 'Дата', icon: Calendar },
  { type: 'file', label: 'Файл', icon: Paperclip },
];

const HAS_OPTIONS: FormFieldType[] = ['select', 'radio', 'checkbox'];

function newField(type: FormFieldType): FormField {
  return {
    id: randomId().slice(0, 8),
    type,
    label: '',
    required: false,
    ...(HAS_OPTIONS.includes(type) ? { options: ['Варіант 1', 'Варіант 2'] } : {}),
  };
}

export function FormEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit, session } = useAuth();
  const isNew = !id;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [style, setStyle] = useState<FormStyle>({ ...DEFAULT_FORM_STYLE });
  const [fields, setFields] = useState<FormField[]>([]);

  useEffect(() => {
    if (!canEdit) navigate('/forms', { replace: true });
  }, [canEdit, navigate]);

  useEffect(() => {
    if (isNew) return;
    void supabase
      .from('forms')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          setTitle(data.title);
          setSlug(data.slug);
          setSlugTouched(true);
          setIsPublished(data.is_published);
          setStyle(parseFormStyle(data.style));
          setFields(parseFormSchema(data.schema).fields);
        }
        setLoading(false);
      });
  }, [id, isNew]);

  const updateField = (fieldId: string, patch: Partial<FormField>) => {
    setFields((prev) => prev.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)));
  };

  const moveField = (index: number, dir: -1 | 1) => {
    setFields((prev) => {
      const next = [...prev];
      const target = index + dir;
      const a = next[index];
      const b = next[target];
      if (!a || !b) return prev;
      next[index] = b;
      next[target] = a;
      return next;
    });
  };

  const save = async (publish?: boolean) => {
    setError(null);
    if (!title.trim()) {
      setError('Вкажіть назву форми');
      return;
    }
    if (fields.length === 0) {
      setError('Додайте хоча б одне поле');
      return;
    }
    if (fields.some((f) => !f.label.trim())) {
      setError('У кожного поля має бути назва');
      return;
    }
    setSaving(true);
    const payload = {
      title: title.trim(),
      slug: slug.trim() || slugify(title),
      schema: { fields } as unknown as Json,
      style: style as unknown as Json,
      is_published: publish ?? isPublished,
    };
    const result = isNew
      ? await supabase
          .from('forms')
          .insert({ ...payload, created_by: session?.user.id ?? null })
          .select('id')
          .single()
      : await supabase.from('forms').update(payload).eq('id', id).select('id').single();
    setSaving(false);
    if (result.error) {
      setError(
        result.error.code === '23505'
          ? 'Форма з таким посиланням (slug) уже існує — змініть його'
          : result.error.message,
      );
      return;
    }
    navigate('/forms');
  };

  if (loading) return <Spinner label="Завантаження форми…" />;

  return (
    <div>
      <PageHeader
        title={isNew ? 'Нова форма' : 'Редагування форми'}
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate('/forms')}>
              <ArrowLeft size={16} /> Назад
            </Button>
            {!isNew && isPublished && (
              <a
                href={`/f/${slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-mist-300 bg-white px-4 text-sm font-semibold text-navy-700 hover:bg-mist-100"
              >
                <ExternalLink size={15} /> Відкрити
              </a>
            )}
            <Button variant="secondary" onClick={() => void save()} loading={saving}>
              {isPublished ? 'Зберегти' : 'Зберегти чернетку'}
            </Button>
            <Button onClick={() => void save(true)} loading={saving}>
              {isPublished ? 'Зберегти й опублікувати' : 'Опублікувати'}
            </Button>
          </>
        }
      />

      {error && (
        <p className="mb-4 rounded-xl bg-error-50 p-3 text-sm font-medium text-error-700">{error}</p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Fields column */}
        <div className="space-y-4">
          <Card className="space-y-4">
            <Field label="Назва форми" required>
              <Input
                value={title}
                placeholder="Реєстрація на літній табір 2026"
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
              />
            </Field>
            <Field label="Посилання (slug)" hint={`Форма буде доступна за адресою /f/${slug || '…'}`}>
              <Input
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
              />
            </Field>
            <Field label="Опис під заголовком">
              <Textarea
                value={style.description ?? ''}
                placeholder="Коротко поясніть, для чого ця форма"
                onChange={(e) => setStyle((s) => ({ ...s, description: e.target.value }))}
              />
            </Field>
          </Card>

          <Card className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-navy-600">Файли для учасників</p>
              <p className="text-xs text-mist-600">
                Правила, бланки заяв тощо. Люди зможуть переглянути й завантажити їх перед
                заповненням форми.
              </p>
            </div>
            <AttachmentUpload
              value={style.attachments}
              onChange={(attachments) => setStyle((s) => ({ ...s, attachments }))}
            />
          </Card>

          {fields.map((field, index) => {
            const meta = FIELD_TYPES.find((t) => t.type === field.type);
            return (
              <Card key={field.id} className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-mist-600">
                    {meta && <meta.icon size={14} className="text-teal-500" />}
                    {meta?.label}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveField(index, -1)}
                      disabled={index === 0}
                      className="rounded-lg p-1.5 text-mist-600 hover:bg-mist-100 disabled:opacity-30"
                      aria-label="Вгору"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveField(index, 1)}
                      disabled={index === fields.length - 1}
                      className="rounded-lg p-1.5 text-mist-600 hover:bg-mist-100 disabled:opacity-30"
                      aria-label="Вниз"
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFields((prev) => prev.filter((f) => f.id !== field.id))}
                      className="rounded-lg p-1.5 text-error-500 hover:bg-error-50"
                      aria-label="Видалити поле"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Назва поля" required>
                    <Input
                      value={field.label}
                      placeholder="Наприклад: Імʼя дитини"
                      onChange={(e) => updateField(field.id, { label: e.target.value })}
                    />
                  </Field>
                  {!HAS_OPTIONS.includes(field.type) && field.type !== 'date' && field.type !== 'file' && (
                    <Field label="Підказка в полі">
                      <Input
                        value={field.placeholder ?? ''}
                        onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                      />
                    </Field>
                  )}
                </div>
                {HAS_OPTIONS.includes(field.type) && (
                  <Field label="Варіанти (по одному в рядку)" required>
                    <Textarea
                      value={(field.options ?? []).join('\n')}
                      onChange={(e) =>
                        updateField(field.id, {
                          options: e.target.value.split('\n'),
                        })
                      }
                      onBlur={(e) =>
                        updateField(field.id, {
                          options: e.target.value
                            .split('\n')
                            .map((o) => o.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </Field>
                )}
                <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-navy-600">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => updateField(field.id, { required: e.target.checked })}
                    className="size-4 accent-teal-500"
                  />
                  Обовʼязкове поле
                </label>
              </Card>
            );
          })}

          <Card>
            <p className="mb-3 text-sm font-semibold text-navy-600">Додати поле</p>
            <div className="flex flex-wrap gap-2">
              {FIELD_TYPES.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => setFields((prev) => [...prev, newField(t.type)])}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-mist-300 px-3 py-2 text-sm font-medium text-navy-600 transition-colors hover:border-teal-400 hover:bg-teal-50 hover:text-teal-700"
                >
                  <Plus size={14} />
                  <t.icon size={14} />
                  {t.label}
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Style column */}
        <div className="space-y-4">
          <Card className="space-y-4">
            <p className="text-sm font-semibold text-navy-600">Оформлення</p>
            <Field label="Акцентний колір">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={style.accentColor}
                  onChange={(e) => setStyle((s) => ({ ...s, accentColor: e.target.value }))}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-mist-300 bg-white p-1"
                />
                <Input
                  value={style.accentColor}
                  onChange={(e) => setStyle((s) => ({ ...s, accentColor: e.target.value }))}
                  className="flex-1"
                />
              </div>
            </Field>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-navy-600">
              <input
                type="checkbox"
                checked={style.showLogo}
                onChange={(e) => setStyle((s) => ({ ...s, showLogo: e.target.checked }))}
                className="size-4 accent-teal-500"
              />
              Показувати логотип Wise Step
            </label>
            <Field label="Обкладинка форми">
              <ImageUpload
                value={style.coverImage}
                onChange={(url) => setStyle((s) => ({ ...s, coverImage: url ?? undefined }))}
                folder="form-covers"
              />
            </Field>
          </Card>

          <Card className="space-y-2 text-sm text-mist-600">
            <p className="font-semibold text-navy-600">Статус</p>
            <p>
              {isPublished
                ? 'Форма опублікована й доступна за публічним посиланням.'
                : 'Чернетка — форма не доступна публічно, доки ви її не опублікуєте.'}
            </p>
            {isPublished && (
              <Button variant="secondary" size="sm" onClick={() => void save(false)} loading={saving}>
                Зняти з публікації
              </Button>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
