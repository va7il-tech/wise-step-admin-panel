import { useEffect, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { useForm, type FieldError } from 'react-hook-form';
import { CheckCircle2, Loader2, SearchX } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { parseFormSchema, parseFormStyle, type FormField, type FormSchema, type FormStyle } from '@/lib/types';
import type { Json, Tables } from '@/lib/database.types';
import { uploadFormFile } from '@/lib/storage';
import { cn } from '@/lib/utils';

type FormValues = Record<string, string | string[] | FileList | undefined>;

/**
 * Public form-fill page (/f/:slug). Mobile-first: this is what parents open
 * from a QR code on a poster, usually on a phone.
 */
export function PublicFormPage() {
  const { slug } = useParams();
  const [form, setForm] = useState<Tables<'forms'> | null | 'not_found'>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    void supabase
      .from('forms')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle()
      .then(({ data }) => setForm(data ?? 'not_found'));
  }, [slug]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

  if (form === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-mist-100">
        <Loader2 size={28} className="animate-spin text-teal-500" />
      </div>
    );
  }

  if (form === 'not_found') {
    return (
      <PublicShell style={{ accentColor: '#01B5B4', showLogo: true }}>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <SearchX size={40} className="text-mist-400" />
          <h1 className="text-lg font-bold text-navy-700">Форму не знайдено</h1>
          <p className="text-sm text-mist-600">
            Можливо, посилання застаріло або форму ще не опубліковано.
          </p>
        </div>
      </PublicShell>
    );
  }

  const schema: FormSchema = parseFormSchema(form.schema);
  const style: FormStyle = parseFormStyle(form.style);

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    try {
      const data: Record<string, Json> = {};
      for (const field of schema.fields) {
        const raw = values[field.id];
        if (field.type === 'file') {
          const file = raw instanceof FileList ? raw[0] : undefined;
          if (file) {
            const path = await uploadFormFile(file, form.id);
            data[field.id] = { file: path, name: file.name };
          } else {
            data[field.id] = null;
          }
        } else if (Array.isArray(raw)) {
          data[field.id] = raw;
        } else {
          data[field.id] = raw ?? '';
        }
      }
      const { error } = await supabase
        .from('form_submissions')
        .insert({ form_id: form.id, data: data as Json });
      if (error) throw new Error(error.message);
      setSubmitted(true);
      window.scrollTo({ top: 0 });
    } catch {
      setSubmitError('Не вдалося надіслати відповідь. Перевірте звʼязок і спробуйте ще раз.');
    }
  };

  return (
    <PublicShell style={style}>
      {style.coverImage && (
        <img
          src={style.coverImage}
          alt=""
          className="mb-5 h-40 w-full rounded-2xl object-cover sm:h-52"
        />
      )}
      <h1 className="text-xl font-bold leading-snug text-navy-700 sm:text-2xl">{form.title}</h1>
      {style.description && <p className="mt-2 text-sm text-mist-600">{style.description}</p>}

      {submitted ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl bg-success-50 px-5 py-10 text-center">
          <CheckCircle2 size={44} className="text-success-500" />
          <h2 className="text-lg font-bold text-navy-700">Дякуємо!</h2>
          <p className="text-sm text-navy-600">
            Вашу відповідь надіслано. Ми звʼяжемося з вами найближчим часом.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5" noValidate>
          {schema.fields.map((field) => (
            <PublicField
              key={field.id}
              field={field}
              accent={style.accentColor}
              register={register}
              error={errors[field.id] as FieldError | undefined}
            />
          ))}
          {submitError && (
            <p className="rounded-xl bg-error-50 p-3 text-sm font-medium text-error-700">
              {submitError}
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{ backgroundColor: style.accentColor }}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isSubmitting && <Loader2 size={18} className="animate-spin" />}
            Надіслати
          </button>
        </form>
      )}
    </PublicShell>
  );
}

function PublicShell({ style, children }: { style: FormStyle; children: React.ReactNode }) {
  return (
    <div
      className="min-h-dvh bg-mist-100 px-4 py-6 sm:py-10"
      style={{ '--accent': style.accentColor } as CSSProperties}
    >
      <div className="mx-auto w-full max-w-lg">
        {style.showLogo && (
          <div className="mb-5 flex items-center justify-center gap-2.5">
            <img src="/logo.svg" alt="Wise Step" className="size-9 rounded-xl" />
            <span className="font-bold text-navy-700">Wise Step</span>
          </div>
        )}
        <div className="rounded-card bg-white p-5 shadow-card sm:p-8">{children}</div>
        <p className="mt-5 text-center text-xs text-mist-500">
          Центр розвитку дітей та молоді «Wise Step», м. Свалява
        </p>
      </div>
    </div>
  );
}

function PublicField({
  field,
  accent,
  register,
  error,
}: {
  field: FormField;
  accent: string;
  register: ReturnType<typeof useForm<FormValues>>['register'];
  error?: FieldError;
}) {
  const rules = {
    required: field.required ? 'Це поле обовʼязкове' : false,
    ...(field.type === 'email'
      ? { pattern: { value: /^\S+@\S+\.\S+$/, message: 'Вкажіть коректну пошту' } }
      : {}),
    ...(field.type === 'phone'
      ? { pattern: { value: /^[+\d][\d\s\-()]{6,}$/, message: 'Вкажіть коректний номер телефону' } }
      : {}),
  };

  const inputClass = cn(
    'w-full rounded-xl border bg-white px-4 py-3 text-base text-navy-700 placeholder:text-mist-500 focus:outline-none focus:ring-2',
    error ? 'border-error-500 ring-error-500/10' : 'border-mist-300',
  );
  const focusStyle = { '--tw-ring-color': `${accent}33`, borderColor: undefined } as CSSProperties;

  const label = (
    <span className="mb-1.5 block text-sm font-semibold text-navy-700">
      {field.label}
      {field.required && <span className="ml-0.5 text-error-500">*</span>}
    </span>
  );
  const errorText = error && (
    <span className="mt-1 block text-xs font-medium text-error-500">{error.message}</span>
  );

  switch (field.type) {
    case 'textarea':
      return (
        <label className="block">
          {label}
          <textarea
            className={cn(inputClass, 'min-h-28')}
            style={focusStyle}
            placeholder={field.placeholder}
            {...register(field.id, rules)}
          />
          {errorText}
        </label>
      );
    case 'select':
      return (
        <label className="block">
          {label}
          <select className={inputClass} style={focusStyle} {...register(field.id, rules)}>
            <option value="">Оберіть…</option>
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {errorText}
        </label>
      );
    case 'radio':
    case 'checkbox':
      return (
        <fieldset>
          <legend className="mb-1.5 block text-sm font-semibold text-navy-700">
            {field.label}
            {field.required && <span className="ml-0.5 text-error-500">*</span>}
          </legend>
          <div className="space-y-2">
            {(field.options ?? []).map((opt) => (
              <label
                key={opt}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-mist-300 px-4 py-3 text-base text-navy-700 transition-colors has-checked:border-(--accent) has-checked:bg-mist-50"
              >
                <input
                  type={field.type}
                  value={opt}
                  style={{ accentColor: accent }}
                  className="size-4.5 shrink-0"
                  {...register(field.id, rules)}
                />
                {opt}
              </label>
            ))}
          </div>
          {errorText}
        </fieldset>
      );
    case 'file':
      return (
        <label className="block">
          {label}
          <input
            type="file"
            className={cn(
              inputClass,
              'file:mr-3 file:rounded-lg file:border-0 file:bg-mist-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-navy-600',
            )}
            {...register(field.id, { required: rules.required })}
          />
          {errorText}
        </label>
      );
    default:
      return (
        <label className="block">
          {label}
          <input
            type={
              field.type === 'phone'
                ? 'tel'
                : field.type === 'number'
                  ? 'number'
                  : field.type === 'date'
                    ? 'date'
                    : field.type
            }
            inputMode={field.type === 'phone' ? 'tel' : field.type === 'number' ? 'numeric' : undefined}
            className={inputClass}
            style={focusStyle}
            placeholder={field.placeholder}
            {...register(field.id, rules)}
          />
          {errorText}
        </label>
      );
  }
}
