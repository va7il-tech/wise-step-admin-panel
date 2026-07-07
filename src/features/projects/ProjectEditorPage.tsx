import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowLeft, HandCoins, ImagePlus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Json, ProjectStatus } from '@/lib/database.types';
import { PROJECT_STATUS_LABELS } from '@/lib/types';
import { useAuth } from '@/features/auth/AuthContext';
import { Button, Card, Field, Input, PageHeader, Select, Spinner, Textarea } from '@/components/ui';
import { ImageUpload } from '@/components/ImageUpload';
import { uploadToMedia } from '@/lib/storage';

interface ProjectFormValues {
  title: string;
  category: string;
  icon: string;
  short_description: string;
  full_description: string;
  read_more: string;
  tags: string; // comma-separated in the UI
  status: ProjectStatus;
  is_fundraiser: boolean;
  goal_amount: string;
  current_amount: string;
  donors_count: string;
  external_donate_url: string;
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

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    defaultValues: { status: 'ongoing', is_fundraiser: false },
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
          reset({
            title: data.title,
            category: data.category,
            icon: data.icon ?? '',
            short_description: data.short_description,
            full_description: data.full_description ?? '',
            read_more: data.read_more ?? '',
            tags: data.tags.join(', '),
            status: data.status,
            is_fundraiser: data.is_fundraiser,
            goal_amount: data.goal_amount?.toString() ?? '',
            current_amount: data.current_amount?.toString() ?? '',
            donors_count: data.donors_count?.toString() ?? '',
            external_donate_url: data.external_donate_url ?? '',
          });
          setCoverImage(data.cover_image);
          setGallery(Array.isArray(data.gallery) ? (data.gallery as string[]) : []);
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

  const onSubmit = async (values: ProjectFormValues) => {
    setError(null);
    const payload = {
      title: values.title.trim(),
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
      is_fundraiser: values.is_fundraiser,
      goal_amount: values.is_fundraiser && values.goal_amount ? Number(values.goal_amount) : null,
      current_amount:
        values.is_fundraiser && values.current_amount ? Number(values.current_amount) : null,
      donors_count:
        values.is_fundraiser && values.donors_count ? Number(values.donors_count) : null,
      external_donate_url:
        values.is_fundraiser && values.external_donate_url.trim()
          ? values.external_donate_url.trim()
          : null,
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
                  <Field label="Посилання на банку / донат" error={errors.external_donate_url?.message}>
                    <Input
                      type="url"
                      placeholder="https://send.monobank.ua/jar/…"
                      {...register('external_donate_url', {
                        validate: (v) =>
                          !v || /^https?:\/\/\S+$/.test(v) || 'Вкажіть коректне посилання',
                      })}
                    />
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
