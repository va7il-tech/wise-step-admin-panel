import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { Button, Field, Input, Card } from '@/components/ui';

interface LoginForm {
  email: string;
  password: string;
}

interface ResetForm {
  email: string;
}

export function LoginPage() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>();
  const {
    register: registerReset,
    handleSubmit: handleResetSubmit,
    formState: { errors: resetErrors, isSubmitting: resetSubmitting },
  } = useForm<ResetForm>();

  if (!loading && session) {
    const from = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }

  const onSubmit = async ({ email, password }: LoginForm) => {
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(
        authError.message === 'Invalid login credentials'
          ? 'Невірна пошта або пароль'
          : authError.message,
      );
    }
  };

  const onReset = async ({ email }: ResetForm) => {
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/accept-invite`,
    });
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setResetSent(true);
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-navy-700 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4">
          <img src="/logo.svg" alt="Wise Step" className="size-16 rounded-2xl shadow-lg" />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Wise Step</h1>
            <p className="mt-1 text-sm text-navy-200">Адміністративна панель</p>
          </div>
        </div>

        <Card className="p-6">
          {!isSupabaseConfigured && (
            <p className="mb-4 rounded-xl bg-gold-100 p-3 text-xs text-gold-700">
              Supabase не налаштовано. Скопіюйте <code>.env.example</code> у <code>.env</code> та
              вкажіть ключі проєкту.
            </p>
          )}
          {resetMode ? (
            resetSent ? (
              <p className="text-sm text-mist-600">
                Якщо такий обліковий запис існує, на пошту надіслано посилання для встановлення
                нового пароля.
              </p>
            ) : (
              <form onSubmit={handleResetSubmit(onReset)} className="space-y-4" noValidate>
                <Field label="Електронна пошта" required error={resetErrors.email?.message}>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="you@wise-step.org"
                    {...registerReset('email', { required: 'Вкажіть пошту' })}
                  />
                </Field>
                {error && (
                  <p className="rounded-xl bg-error-50 p-3 text-sm font-medium text-error-700">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" size="lg" loading={resetSubmitting}>
                  Надіслати посилання
                </Button>
              </form>
            )
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <Field label="Електронна пошта" required error={errors.email?.message}>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="you@wise-step.org"
                  {...register('email', { required: 'Вкажіть пошту' })}
                />
              </Field>
              <Field label="Пароль" required error={errors.password?.message}>
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register('password', { required: 'Вкажіть пароль' })}
                />
              </Field>
              {error && (
                <p className="rounded-xl bg-error-50 p-3 text-sm font-medium text-error-700">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
                Увійти
              </Button>
            </form>
          )}
          <button
            type="button"
            onClick={() => {
              setError(null);
              setResetSent(false);
              setResetMode((v) => !v);
            }}
            className="mt-4 text-xs font-medium text-teal-600 hover:underline"
          >
            {resetMode ? 'Повернутися до входу' : 'Забули пароль?'}
          </button>
        </Card>

        <p className="mt-6 text-center text-xs text-navy-300">
          Доступ надається запрошенням. Зверніться до адміністратора організації.
        </p>
      </div>
    </div>
  );
}
