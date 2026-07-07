import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { Button, Field, Input, Card, Spinner } from '@/components/ui';

interface SetPasswordForm {
  password: string;
  confirmPassword: string;
}

/** Landing page for the invite email link: the Supabase client already turns the
 *  link's token into a session, this just asks the invitee to set a password. */
export function AcceptInvitePage() {
  const { session, loading } = useAuth();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SetPasswordForm>();

  if (loading) return <Spinner label="Перевірка запрошення…" />;
  if (done) return <Navigate to="/" replace />;

  const onSubmit = async ({ password }: SetPasswordForm) => {
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-navy-700 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4">
          <img src="/logo.svg" alt="Wise Step" className="size-16 rounded-2xl shadow-lg" />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Wise Step</h1>
            <p className="mt-1 text-sm text-navy-200">Встановлення пароля</p>
          </div>
        </div>

        <Card className="p-6">
          {!session ? (
            <p className="text-sm text-mist-600">
              Посилання-запрошення недійсне або застаріле. Попросіть адміністратора надіслати
              нове.
            </p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <Field label="Новий пароль" required error={errors.password?.message}>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  {...register('password', {
                    required: 'Вкажіть пароль',
                    minLength: { value: 8, message: 'Щонайменше 8 символів' },
                  })}
                />
              </Field>
              <Field label="Підтвердіть пароль" required error={errors.confirmPassword?.message}>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  {...register('confirmPassword', {
                    required: 'Підтвердіть пароль',
                    validate: (value) => value === watch('password') || 'Паролі не збігаються',
                  })}
                />
              </Field>
              {error && (
                <p className="rounded-xl bg-error-50 p-3 text-sm font-medium text-error-700">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
                Встановити пароль
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
