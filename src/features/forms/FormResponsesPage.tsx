import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Inbox, Paperclip, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';
import { parseFormSchema, type FormSchema } from '@/lib/types';
import { downloadCsv, formatDateTime } from '@/lib/utils';
import { signedFormFileUrl } from '@/lib/storage';
import { useAuth } from '@/features/auth/AuthContext';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Modal,
  PageHeader,
  Spinner,
} from '@/components/ui';

type Submission = Tables<'form_submissions'>;

const PAGE_SIZE = 20;

interface FileAnswer {
  file: string;
  name: string;
}

function isFileAnswer(value: unknown): value is FileAnswer {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as FileAnswer).file === 'string' &&
    typeof (value as FileAnswer).name === 'string'
  );
}

function answerToText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (isFileAnswer(value)) return value.name;
  return String(value);
}

export function FormResponsesPage() {
  const { id } = useParams();
  const { canEdit } = useAuth();
  const [form, setForm] = useState<Tables<'forms'> | null>(null);
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<Submission | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Submission | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!id) return;
    void supabase
      .from('forms')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => setForm(data));
  }, [id]);

  const load = useCallback(async () => {
    if (!id) return;
    setSubmissions(null);
    const from = page * PAGE_SIZE;
    const { data, count } = await supabase
      .from('form_submissions')
      .select('*', { count: 'exact' })
      .eq('form_id', id)
      .order('submitted_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    setSubmissions(data ?? []);
    setTotal(count ?? 0);
  }, [id, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const schema: FormSchema = form ? parseFormSchema(form.schema) : { fields: [] };
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const exportCsv = async () => {
    if (!id || !form) return;
    setExporting(true);
    // Export everything, not just the current page.
    const all: Submission[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data } = await supabase
        .from('form_submissions')
        .select('*')
        .eq('form_id', id)
        .order('submitted_at', { ascending: true })
        .range(offset, offset + 999);
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < 1000) break;
    }
    const headers = ['Дата', ...schema.fields.map((f) => f.label)];
    const rows = all.map((s) => {
      const data = (s.data ?? {}) as Record<string, unknown>;
      return [
        formatDateTime(s.submitted_at),
        ...schema.fields.map((f) => answerToText(data[f.id])),
      ];
    });
    downloadCsv(`${form.slug}-vidpovidi.csv`, headers, rows);
    setExporting(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from('form_submissions').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    setDetail(null);
    await load();
  };

  // Show at most the first 3 fields as table columns; the rest live in the detail view.
  const columns = schema.fields.slice(0, 3);

  return (
    <div>
      <PageHeader
        title={form ? `Відповіді: ${form.title}` : 'Відповіді'}
        subtitle={`Всього відповідей: ${total}`}
        actions={
          <>
            <Link
              to="/forms"
              className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-navy-500 hover:bg-navy-50"
            >
              <ArrowLeft size={16} /> До форм
            </Link>
            <Button variant="secondary" onClick={() => void exportCsv()} loading={exporting} disabled={total === 0}>
              <Download size={16} /> Експорт CSV
            </Button>
          </>
        }
      />

      {submissions === null ? (
        <Spinner label="Завантаження відповідей…" />
      ) : submissions.length === 0 ? (
        <EmptyState
          icon={<Inbox size={22} />}
          title="Відповідей поки немає"
          description="Поділіться посиланням або QR-кодом форми — відповіді зʼявляться тут."
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-x-auto p-0 md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mist-200 text-left text-xs uppercase tracking-wide text-mist-600">
                  <th className="px-5 py-3.5 font-semibold">Дата</th>
                  {columns.map((f) => (
                    <th key={f.id} className="px-5 py-3.5 font-semibold">
                      {f.label}
                    </th>
                  ))}
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => {
                  const data = (s.data ?? {}) as Record<string, unknown>;
                  return (
                    <tr
                      key={s.id}
                      className="cursor-pointer border-b border-mist-100 transition-colors last:border-0 hover:bg-mist-50"
                      onClick={() => setDetail(s)}
                    >
                      <td className="whitespace-nowrap px-5 py-3.5 text-mist-600">
                        {formatDateTime(s.submitted_at)}
                      </td>
                      {columns.map((f) => (
                        <td key={f.id} className="max-w-56 truncate px-5 py-3.5 text-navy-700">
                          {answerToText(data[f.id])}
                        </td>
                      ))}
                      <td className="px-5 py-3.5 text-right text-xs font-semibold text-teal-600">
                        Деталі →
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {submissions.map((s) => {
              const data = (s.data ?? {}) as Record<string, unknown>;
              return (
                <button key={s.id} onClick={() => setDetail(s)} className="w-full text-left">
                  <Card className="space-y-1.5">
                    <p className="text-xs text-mist-500">{formatDateTime(s.submitted_at)}</p>
                    {columns.map((f) => (
                      <p key={f.id} className="text-sm">
                        <span className="text-mist-600">{f.label}: </span>
                        <span className="font-medium text-navy-700">{answerToText(data[f.id])}</span>
                      </p>
                    ))}
                  </Card>
                </button>
              );
            })}
          </div>

          {pageCount > 1 && (
            <div className="mt-5 flex items-center justify-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={15} />
              </Button>
              <span className="text-sm text-mist-600">
                {page + 1} / {pageCount}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= pageCount - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight size={15} />
              </Button>
            </div>
          )}
        </>
      )}

      {detail && (
        <Modal open onClose={() => setDetail(null)} title="Відповідь" wide>
          <p className="mb-4 text-xs text-mist-500">{formatDateTime(detail.submitted_at)}</p>
          <dl className="space-y-4">
            {schema.fields.map((f) => {
              const value = ((detail.data ?? {}) as Record<string, unknown>)[f.id];
              return (
                <div key={f.id}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-mist-600">
                    {f.label}
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm text-navy-700">
                    {isFileAnswer(value) ? (
                      <FileLink answer={value} />
                    ) : (
                      answerToText(value)
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
          {canEdit && (
            <div className="mt-6 flex justify-end border-t border-mist-100 pt-4">
              <Button variant="danger" size="sm" onClick={() => setDeleteTarget(detail)}>
                <Trash2 size={14} /> Видалити відповідь
              </Button>
            </div>
          )}
        </Modal>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title="Видалити відповідь?"
        message="Цю відповідь буде видалено назавжди."
        loading={deleting}
      />
    </div>
  );
}

function FileLink({ answer }: { answer: FileAnswer }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    void signedFormFileUrl(answer.file).then(setUrl);
  }, [answer.file]);
  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 font-medium text-teal-600 hover:text-teal-700"
    >
      <Paperclip size={14} /> {answer.name}
    </a>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-mist-500">
      <Paperclip size={14} /> {answer.name}
    </span>
  );
}
