import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Plus, QrCode, Pencil, Trash2, Inbox } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';
import { formatDate } from '@/lib/utils';
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
import { ShareModal } from '@/components/ShareModal';

type FormRow = Tables<'forms'> & { form_submissions: { count: number }[] };

export function FormsListPage() {
  const { canEdit } = useAuth();
  const navigate = useNavigate();
  const [forms, setForms] = useState<FormRow[] | null>(null);
  const [shareTarget, setShareTarget] = useState<FormRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FormRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('forms')
      .select('*, form_submissions(count)')
      .order('created_at', { ascending: false });
    setForms((data as FormRow[] | null) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from('forms').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    await load();
  };

  const submissionCount = (form: FormRow) => form.form_submissions[0]?.count ?? 0;
  const publicUrl = (form: FormRow) => `${window.location.origin}/f/${form.slug}`;

  return (
    <div>
      <PageHeader
        title="Форми"
        subtitle="Реєстраційні форми для заходів, таборів і гуртків"
        actions={
          canEdit && (
            <Button onClick={() => navigate('/forms/new')}>
              <Plus size={16} /> Нова форма
            </Button>
          )
        }
      />

      {forms === null ? (
        <Spinner label="Завантаження форм…" />
      ) : forms.length === 0 ? (
        <EmptyState
          icon={<FileText size={22} />}
          title="Форм поки немає"
          description="Створіть першу форму — наприклад, реєстрацію на літній табір."
          action={
            canEdit && (
              <Button onClick={() => navigate('/forms/new')}>
                <Plus size={16} /> Створити форму
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {forms.map((form) => (
            <Card key={form.id} className="flex flex-col gap-3 transition-shadow hover:shadow-card-hover">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-snug text-navy-700">{form.title}</h3>
                <Badge tone={form.is_published ? 'success' : 'mist'}>
                  {form.is_published ? 'Опубліковано' : 'Чернетка'}
                </Badge>
              </div>
              <p className="text-xs text-mist-600">
                Створено {formatDate(form.created_at)} · /f/{form.slug}
              </p>
              <Link
                to={`/forms/${form.id}/responses`}
                className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700"
              >
                <Inbox size={15} />
                Відповіді: {submissionCount(form)}
              </Link>
              <div className="mt-auto flex flex-wrap gap-2 border-t border-mist-100 pt-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShareTarget(form)}
                  disabled={!form.is_published}
                  title={form.is_published ? undefined : 'Спершу опублікуйте форму'}
                >
                  <QrCode size={14} /> Поділитися
                </Button>
                {canEdit && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/forms/${form.id}/edit`)}
                    >
                      <Pencil size={14} /> Редагувати
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => setDeleteTarget(form)}>
                      <Trash2 size={14} />
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {shareTarget && (
        <ShareModal
          open
          onClose={() => setShareTarget(null)}
          url={publicUrl(shareTarget)}
          title={`Поділитися: ${shareTarget.title}`}
          fileName={`wisestep-form-${shareTarget.slug}`}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title="Видалити форму?"
        message={`«${deleteTarget?.title}» та всі її відповіді буде видалено назавжди.`}
        loading={deleting}
      />
    </div>
  );
}
