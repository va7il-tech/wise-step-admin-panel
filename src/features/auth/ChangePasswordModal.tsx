import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '@/lib/supabase';
import { Button, Field, Input, Modal } from '@/components/ui';

interface ChangePasswordForm {
  password: string;
  confirmPassword: string;
}

export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordForm>();

  const close = () => {
    reset();
    setError(null);
    setDone(false);
    onClose();
  };

  const onSubmit = async ({ password }: ChangePasswordForm) => {
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
  };

  return (
    <Modal open={open} onClose={close} title="Змінити пароль">
      {done ? (
        <div className="space-y-4">
          <p className="text-sm text-mist-600">Пароль оновлено.</p>
          <div className="flex justify-end">
            <Button onClick={close}>Готово</Button>
          </div>
        </div>
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
            <p className="rounded-xl bg-error-50 p-3 text-sm font-medium text-error-700">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={close}>
              Скасувати
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Зберегти
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
