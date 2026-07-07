import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { UserPlus, Users as UsersIcon, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Role, Tables } from '@/lib/database.types';
import { ROLE_LABELS } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/features/auth/AuthContext';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
} from '@/components/ui';

type Profile = Tables<'profiles'>;

const ROLE_TONES: Record<Role, 'teal' | 'navy' | 'mist'> = {
  super_admin: 'teal',
  editor: 'navy',
  viewer: 'mist',
};

interface InviteForm {
  email: string;
  fullName: string;
  role: Role;
}

export function UsersPage() {
  const { profile: me, refreshProfile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<Profile | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteForm>({ defaultValues: { role: 'viewer' } });

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });
    setProfiles(data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const invite = async (values: InviteForm) => {
    setInviteError(null);
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: { action: 'invite', email: values.email, fullName: values.fullName, role: values.role },
    });
    const serverError = (data as { error?: string } | null)?.error;
    if (error || serverError) {
      setInviteError(serverError ?? 'Не вдалося надіслати запрошення');
      return;
    }
    setInviteOpen(false);
    reset();
    setNotice(`Запрошення надіслано на ${values.email}`);
    await load();
  };

  const changeRole = async (target: Profile, role: Role) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', target.id);
    if (!error) {
      setProfiles((prev) => prev?.map((p) => (p.id === target.id ? { ...p, role } : p)) ?? null);
      if (target.id === me?.id) await refreshProfile();
    }
  };

  const revoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: { action: 'revoke', userId: revokeTarget.id },
    });
    setRevoking(false);
    const serverError = (data as { error?: string } | null)?.error;
    if (error || serverError) {
      setNotice(serverError ?? 'Не вдалося відкликати доступ');
      return;
    }
    setRevokeTarget(null);
    await load();
  };

  return (
    <div>
      <PageHeader
        title="Користувачі"
        subtitle="Запрошення, ролі та доступ до адмін-панелі"
        actions={
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus size={16} /> Запросити
          </Button>
        }
      />

      {notice && (
        <p className="mb-4 rounded-xl bg-teal-50 p-3 text-sm font-medium text-teal-700">{notice}</p>
      )}

      {profiles === null ? (
        <Spinner label="Завантаження користувачів…" />
      ) : profiles.length === 0 ? (
        <EmptyState
          icon={<UsersIcon size={22} />}
          title="Поки нікого немає"
          description="Запросіть колег електронною поштою — вони отримають лист із посиланням для входу."
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-x-auto p-0 md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mist-200 text-left text-xs uppercase tracking-wide text-mist-600">
                  <th className="px-5 py-3.5 font-semibold">Користувач</th>
                  <th className="px-5 py-3.5 font-semibold">Роль</th>
                  <th className="px-5 py-3.5 font-semibold">Доданий</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id} className="border-b border-mist-100 last:border-0">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-navy-700">{p.full_name || '—'}</p>
                      <p className="text-xs text-mist-600">{p.email}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      {p.id === me?.id ? (
                        <Badge tone={ROLE_TONES[p.role]}>{ROLE_LABELS[p.role]} (ви)</Badge>
                      ) : (
                        <Select
                          value={p.role}
                          onChange={(e) => void changeRole(p, e.target.value as Role)}
                          className="w-44"
                        >
                          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </Select>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-mist-600">{formatDate(p.created_at)}</td>
                    <td className="px-5 py-3.5 text-right">
                      {p.id !== me?.id && (
                        <Button variant="danger" size="sm" onClick={() => setRevokeTarget(p)}>
                          <Trash2 size={14} /> Відкликати
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {profiles.map((p) => (
              <Card key={p.id} className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-navy-700">{p.full_name || '—'}</p>
                    <p className="truncate text-xs text-mist-600">{p.email}</p>
                  </div>
                  <Badge tone={ROLE_TONES[p.role]}>{ROLE_LABELS[p.role]}</Badge>
                </div>
                {p.id !== me?.id && (
                  <div className="flex items-center gap-2">
                    <Select
                      value={p.role}
                      onChange={(e) => void changeRole(p, e.target.value as Role)}
                      className="flex-1"
                    >
                      {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </Select>
                    <Button variant="danger" size="sm" onClick={() => setRevokeTarget(p)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Запросити користувача">
        <form onSubmit={handleSubmit(invite)} className="space-y-4" noValidate>
          <Field label="Електронна пошта" required error={errors.email?.message}>
            <Input
              type="email"
              placeholder="colleague@wise-step.org"
              {...register('email', { required: 'Вкажіть пошту' })}
            />
          </Field>
          <Field label="Імʼя та прізвище">
            <Input placeholder="Оксана Петренко" {...register('fullName')} />
          </Field>
          <Field
            label="Роль"
            required
            hint="Редактор керує контентом; спостерігач лише переглядає; суперадмін також керує користувачами."
          >
            <Select {...register('role')}>
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </Field>
          {inviteError && (
            <p className="rounded-xl bg-error-50 p-3 text-sm font-medium text-error-700">
              {inviteError}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setInviteOpen(false)}>
              Скасувати
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Надіслати запрошення
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => void revoke()}
        title="Відкликати доступ?"
        message={`${revokeTarget?.full_name || revokeTarget?.email || 'Користувач'} втратить доступ до адмін-панелі назавжди. Обліковий запис буде видалено.`}
        confirmLabel="Відкликати"
        loading={revoking}
      />
    </div>
  );
}
