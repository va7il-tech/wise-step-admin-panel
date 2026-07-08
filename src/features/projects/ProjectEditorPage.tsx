import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { AlertTriangle, ArrowLeft, HandCoins, ImagePlus, Plus, Sparkles, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Json, ProjectStatus } from '@/lib/database.types';
import { COLOR_CLASS_OPTIONS, PROJECT_LIFECYCLE_LABELS, PROJECT_STATUS_LABELS } from '@/lib/types';
import { getPublishBlockers, parsePresentation, type ProjectPresentation } from '@/lib/projects';
import { slugify } from '@/lib/utils';
import { useAuth } from '@/features/auth/AuthContext';
import { Button, Card, Field, Input, PageHeader, Select, Spinner, Textarea } from '@/components/ui';
import { ImageUpload } from '@/components/ImageUpload';
import { uploadToMedia } from '@/lib/storage';

interface ProjectFormValues {
  title: string;
  slug: string;
  category: string;
  icon: string;
  short_description: string;
  full_description: string;
  read_more: string;
  tags: string; // comma-separated in the UI
  status: ProjectStatus;
  lifecycle: '' | 'active' | 'upcoming';
  badge: string;
  sort_order: string;
  featured: boolean;
  published: boolean;
  is_fundraiser: boolean;
  goal_amount: string;
  current_amount: string;
  donors_count: string;
  external_donate_url: string;
  // presentation copy
  donate_title: string;
  donate_btn: string;
  donate_note: string;
  color_class: string;
  gradient_emoji: string;
  preset_amounts: string; // comma-separated in the UI
}

interface DetailRow {
  label: string;
  value: string;
}

export function ProjectEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit, session } = useAuth();
  const isNew = !id;

  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [gallery, setGallery] = useState<string[]>([]);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [popupDetails, setPopupDetails] = useState<DetailRow[]>([]);
  // Full presentation blob as loaded — preserved on save so keys the form does
  // not expose (success, preset_active_idx, cta_details_action…) survive edits.
  const [loadedPresentation, setLoadedPresentation] = useState<ProjectPresentation>({});

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    defaultValues: {
      status: 'ongoing',
      lifecycle: '',
      sort_order: '0',
      featured: false,
      published: false,
      is_fundraiser: false,
      color_class: '',
    },
  });

  const isFundraiser = watch('is_fundraiser');

  useEffect(() => {
    if (!canEdit) navigate('/projects', { replace: true });
  }, [canEdit, navigate]);

  useEffect(() => {
    if (isNew) return;
    void supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          const p = parsePresentation(data.presentation);
          setLoadedPresentation(p);
          reset({
            title: data.title,
            slug: data.slug ?? '',
            category: data.category,
            icon: data.icon ?? '',
            short_description: data.short_description,
            full_description: data.full_description ?? '',
            read_more: data.read_more ?? '',
            tags: data.tags.join(', '),
            status: data.status,
            lifecycle: data.lifecycle ?? '',
            badge: data.badge ?? '',
            sort_order: data.sort_order?.toString() ?? '0',
            featured: data.featured,
            published: data.published,
            is_fundraiser: data.is_fundraiser,
            goal_amount: data.goal_amount?.toString() ?? '',
            current_amount: data.current_amount?.toString() ?? '',
            donors_count: data.donors_count?.toString() ?? '',
            external_donate_url: data.external_donate_url ?? '',
            donate_title: p.donate_title ?? '',
            donate_btn: p.donate_btn ?? '',
            donate_note: p.donate_note ?? '',
            color_class: p.color_class ?? '',
            gradient_emoji: p.gradient_emoji ?? '',
            preset_amounts: Array.isArray(p.preset_amounts) ? p.preset_amounts.join(', ') : '',
          });
          setCoverImage(data.cover_image);
          setGallery(Array.isArray(data.gallery) ? (data.gallery as string[]) : []);
          setPopupDetails(
            Array.isArray(p.popup_details)
              ? p.popup_details.map(([label, value]) => ({ label: label ?? '', value: value ?? '' }))
              : [],
          );
        }
        setLoading(false);
      });
  }, [id, isNew, reset]);

  const addGalleryImage = async (file: File) => {
    setGalleryUploading(true);
    try {
      const url = await uploadToMedia(file, 'project-gallery');
      setGallery((prev) => [...prev, url]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося завантажити зображення');
    } finally {
      setGalleryUploading(false);
    }
  };

  // Live completeness check — mirrors the DB/site publish gate so the admin sees
  // exactly why a project is not publishable before flipping the toggle.
  const watched = watch();
  const cleanDetails = popupDetails.filter((d) => d.label.trim() && d.value.trim());
  const publishBlockers = useMemo(
    () =>
      getPublishBlockers({
        slug: watched.slug ?? '',
        title: watched.title ?? '',
        full_description: watched.full_description ?? '',
        external_donate_url: watched.external_donate_url ?? '',
        presentation: {
          popup_details: cleanDetails.map((d) => [d.label.trim(), d.value.trim()]),
          donate_title: watched.donate_title,
          donate_btn: watched.donate_btn,
          color_class: watched.color_class,
          gradient_emoji: watched.gradient_emoji,
        } as Json,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      watched.slug,
      watched.title,
      watched.full_description,
      watched.external_donate_url,
      watched.donate_title,
      watched.donate_btn,
      watched.color_class,
      watched.gradient_emoji,
      popupDetails,
    ],
  );

  const onSubmit = async (values: ProjectFormValues) => {
    setError(null);

    const slug = slugify(values.slug);

    // Hard-block publishing an incomplete project — the RLS gate is the primary
    // safeguard, this stops the admin from shipping a broken card in the first place.
    if (values.published && publishBlockers.length > 0) {
      setError(
        `Неможливо опублікувати: ${publishBlockers.join(' ')} Зніміть позначку «Опубліковано» або заповніть поля.`,
      );
      return;
    }

    const details = popupDetails
      .filter((d) => d.label.trim() && d.value.trim())
      .map((d) => [d.label.trim(), d.value.trim()] as [string, string]);
    const presets = values.preset_amounts
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const presentation: ProjectPresentation = {
      ...loadedPresentation, // preserve unexposed keys (success, preset_active_idx…)
      popup_details: details,
      donate_title: values.donate_title.trim(),
      donate_btn: values.donate_btn.trim(),
      donate_note: values.donate_note.trim(),
      color_class: values.color_class,
      gradient_emoji: values.gradient_emoji.trim(),
      preset_amounts: presets,
    };
    if (!presentation.cta_details_action && slug) {
      presentation.cta_details_action = `openPopup('${slug}')`;
    }

    const payload = {
      title: values.title.trim(),
      slug,
      category: values.category.trim(),
      icon: values.icon.trim() || null,
      short_description: values.short_description.trim(),
      full_description: values.full_description.trim() || null,
      read_more: values.read_more.trim() || null,
      cover_image: coverImage,
      gallery: gallery as unknown as Json,
      tags: values.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      status: values.status,
      lifecycle: values.lifecycle || null,
      badge: values.badge.trim() || null,
      sort_order: Number(values.sort_order) || 0,
      featured: values.featured,
      published: values.published,
      is_fundraiser: values.is_fundraiser,
      goal_amount: values.is_fundraiser && values.goal_amount ? Number(values.goal_amount) : null,
      current_amount:
        values.is_fundraiser && values.current_amount ? Number(values.current_amount) : null,
      donors_count:
        values.is_fundraiser && values.donors_count ? Number(values.donors_count) : null,
      external_donate_url: values.external_donate_url.trim() || null,
      presentation: presentation as unknown as Json,
    };
    const result = isNew
      ? await supabase.from('projects').insert({ ...payload, created_by: session?.user.id ?? null })
      : await supabase.from('projects').update(payload).eq('id', id);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    navigate('/projects');
  };

  if (loading) return <Spinner label="Завантаження проєкту…" />;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <PageHeader
        title={isNew ? 'Новий проєкт' : 'Редагування проєкту'}
        actions={
          <>
            <Button type="button" variant="ghost" onClick={() => navigate('/projects')}>
              <ArrowLeft size={16} /> Назад
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Зберегти
            </Button>
          </>
        }
      />

      {error && (
        <p className="mb-4 rounded-xl bg-error-50 p-3 text-sm font-medium text-error-700">{error}</p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card className="space-y-4">
            <Field label="Назва" required error={errors.title?.message}>
              <Input
                placeholder="Флорбольний клуб"
                {...register('title', { required: 'Вкажіть назву' })}
              />
            </Field>
            <Field
              label="Slug"
              required
              hint="Короткий латинський ключ, як у решти проєктів: florball, cup2026"
              error={errors.slug?.message}
            >
              <div className="flex gap-2">
                <Input
                  placeholder="florball"
                  {...register('slug', {
                    required: 'Вкажіть slug',
                    setValueAs: (v: string) => v.trim(),
                  })}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setValue('slug', slugify(watched.title ?? ''), { shouldDirty: true })}
                >
                  <Sparkles size={14} /> З назви
                </Button>
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <Field label="Категорія" required error={errors.category?.message}>
                <Input
                  placeholder="Спорт"
                  {...register('category', { required: 'Вкажіть категорію' })}
                />
              </Field>
              <Field label="Іконка" hint="Емодзі">
                <Input placeholder="🏑" maxLength={4} {...register('icon')} />
              </Field>
            </div>
            <Field label="Короткий опис" required error={errors.short_description?.message}>
              <Textarea
                className="min-h-16"
                placeholder="Один-два рядки для картки проєкту"
                {...register('short_description', { required: 'Вкажіть короткий опис' })}
              />
            </Field>
            <Field label="Повний опис" hint="Абзаци зберігаються; текст показується як на сайті">
              <Textarea className="min-h-40" {...register('full_description')} />
            </Field>
            <Field label="Читати більше" hint="Додатковий розгорнутий текст (необовʼязково)">
              <Textarea className="min-h-24" {...register('read_more')} />
            </Field>
            <Field label="Теги" hint="Через кому: спорт, діти, флорбол">
              <Input {...register('tags')} />
            </Field>
          </Card>

          {/* Donate & presentation — the fields the public popup needs. */}
          <Card className="space-y-4">
            <p className="text-sm font-semibold text-navy-700">Донат і презентація</p>
            <Field
              label="Посилання на банку / донат"
              hint="Спільна банка проєктів або окрема. Приклад «/jar/example» не приймається."
              error={errors.external_donate_url?.message}
            >
              <Input
                type="url"
                placeholder="https://send.monobank.ua/jar/…"
                {...register('external_donate_url', {
                  validate: (v) => !v || /^https?:\/\/\S+$/.test(v) || 'Вкажіть коректне посилання',
                })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Заголовок блоку донату" hint="donate_title">
                <Input placeholder="💛 Підтримати проєкт" {...register('donate_title')} />
              </Field>
              <Field label="Текст кнопки донату" hint="donate_btn">
                <Input placeholder="💛 Задонатити" {...register('donate_btn')} />
              </Field>
            </div>
            <Field label="Примітка під кнопкою" hint="donate_note (необовʼязково)">
              <Input placeholder="Кошти підуть на: …" {...register('donate_note')} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Кольорова тема" hint="color_class">
                <Select {...register('color_class')}>
                  <option value="">— оберіть —</option>
                  {COLOR_CLASS_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label} ({value})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Емодзі-градієнт" hint="gradient_emoji (необовʼязково)">
                <Input placeholder="🏑🥅" maxLength={8} {...register('gradient_emoji')} />
              </Field>
            </div>
            <Field label="Пресети сум" hint="Через кому: 200 грн, 500 грн, 1 000 грн">
              <Input placeholder="200 грн, 500 грн, 1 000 грн" {...register('preset_amounts')} />
            </Field>

            <div className="space-y-2">
              <p className="text-sm font-medium text-navy-600">Деталі (рядки popup)</p>
              {popupDetails.map((row, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    className="sm:w-2/5"
                    placeholder="📍 Локація"
                    value={row.label}
                    onChange={(e) =>
                      setPopupDetails((prev) =>
                        prev.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)),
                      )
                    }
                  />
                  <Input
                    placeholder="Свалява та с. Поляна"
                    value={row.value}
                    onChange={(e) =>
                      setPopupDetails((prev) =>
                        prev.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)),
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setPopupDetails((prev) => prev.filter((_, j) => j !== i))}
                    className="rounded-lg px-2 text-mist-500 hover:bg-error-50 hover:text-error-600"
                    aria-label="Прибрати рядок"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setPopupDetails((prev) => [...prev, { label: '', value: '' }])}
              >
                <Plus size={14} /> Додати рядок
              </Button>
            </div>
          </Card>

          <Card className="space-y-4">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input type="checkbox" className="size-4 accent-gold-500" {...register('is_fundraiser')} />
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-700">
                <HandCoins size={16} className="text-gold-600" />
                Проєкт зі збором коштів
              </span>
            </label>
            {isFundraiser && (
              <div className="space-y-4 rounded-xl bg-gold-100/50 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Ціль збору, грн" error={errors.goal_amount?.message}>
                    <Input
                      type="number"
                      min="0"
                      placeholder="120000"
                      {...register('goal_amount', {
                        validate: (v) =>
                          !isFundraiser || !v || Number(v) > 0 || 'Сума має бути більшою за 0',
                      })}
                    />
                  </Field>
                  <Field label="Зібрано, грн">
                    <Input type="number" min="0" placeholder="47500" {...register('current_amount')} />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Кількість донорів">
                    <Input type="number" min="0" placeholder="63" {...register('donors_count')} />
                  </Field>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="space-y-4">
            <Field label="Статус">
              <Select {...register('status')}>
                {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Життєвий цикл" hint="Активний / Незабаром (як на сайті)">
              <Select {...register('lifecycle')}>
                <option value="">—</option>
                {Object.entries(PROJECT_LIFECYCLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Підпис-бейдж" hint='Напр. «Спорт · Постійний проєкт»'>
              <Input placeholder="Спорт · Постійний проєкт" {...register('badge')} />
            </Field>
            <Field label="Порядок сортування" hint="Менше = вище на сайті">
              <Input type="number" {...register('sort_order')} />
            </Field>
            <label className="flex cursor-pointer items-center gap-2.5">
              <input type="checkbox" className="size-4 accent-gold-500" {...register('featured')} />
              <span className="text-sm font-semibold text-navy-700">Виділений (featured)</span>
            </label>
          </Card>

          {/* Publish gate — the visible second layer over the RLS filter. */}
          <Card className="space-y-3">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input type="checkbox" className="size-4 accent-teal-500" {...register('published')} />
              <span className="text-sm font-semibold text-navy-700">Опубліковано на сайті</span>
            </label>
            {publishBlockers.length > 0 ? (
              <div className="rounded-xl bg-gold-100/60 p-3">
                <p className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-gold-700">
                  <AlertTriangle size={13} /> Не готовий до публікації:
                </p>
                <ul className="list-disc space-y-0.5 pl-4 text-xs text-navy-600">
                  {publishBlockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-success-700">✓ Усі поля заповнені — проєкт можна публікувати.</p>
            )}
          </Card>

          <Card className="space-y-4">
            <Field label="Обкладинка">
              <ImageUpload value={coverImage} onChange={setCoverImage} folder="project-covers" />
            </Field>
          </Card>

          <Card className="space-y-3">
            <p className="text-sm font-semibold text-navy-600">Галерея</p>
            {gallery.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {gallery.map((url) => (
                  <div key={url} className="relative">
                    <img src={url} alt="" className="h-20 w-full rounded-lg object-cover" />
                    <button
                      type="button"
                      onClick={() => setGallery((prev) => prev.filter((u) => u !== url))}
                      className="absolute right-1 top-1 rounded-md bg-navy-900/60 p-1 text-white hover:bg-navy-900/80"
                      aria-label="Прибрати зображення"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="flex h-16 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-mist-300 text-sm text-mist-600 transition-colors hover:border-teal-400 hover:text-teal-600">
              <ImagePlus size={17} />
              {galleryUploading ? 'Завантаження…' : 'Додати фото'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void addGalleryImage(file);
                  e.target.value = '';
                }}
              />
            </label>
          </Card>
        </div>
      </div>
    </form>
  );
}
