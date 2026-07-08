import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderHeart, HandCoins, Pencil, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ProjectStatus, Tables } from '@/lib/database.types';
import { PROJECT_STATUS_LABELS } from '@/lib/types';
import { cn, formatUah } from '@/lib/utils';
import { useAuth } from '@/features/auth/AuthContext';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  Select,
  Spinner,
} from '@/components/ui';

type Project = Tables<'projects'>;

const STATUS_TONES: Record<ProjectStatus, 'teal' | 'navy' | 'gold'> = {
  ongoing: 'teal',
  one_time: 'navy',
  campaign: 'gold',
};

export function ProjectsListPage() {
  const { canEdit } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    setProjects(data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(
    () => [...new Set((projects ?? []).map((p) => p.category))].sort(),
    [projects],
  );

  const filtered = (projects ?? []).filter(
    (p) =>
      (!categoryFilter || p.category === categoryFilter) &&
      (!statusFilter || p.status === statusFilter),
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from('projects').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    await load();
  };

  return (
    <div>
      <PageHeader
        title="Проєкти"
        subtitle="Активності, табори та збори організації"
        actions={
          canEdit && (
            <Button onClick={() => navigate('/projects/new')}>
              <Plus size={16} /> Новий проєкт
            </Button>
          )
        }
      />

      {projects !== null && projects.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full sm:w-48"
          >
            <option value="">Усі категорії</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-48"
          >
            <option value="">Усі статуси</option>
            {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      )}

      {projects === null ? (
        <Spinner label="Завантаження проєктів…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FolderHeart size={22} />}
          title={projects.length === 0 ? 'Проєктів поки немає' : 'Нічого не знайдено'}
          description={
            projects.length === 0
              ? 'Додайте перший проєкт — наприклад, флорбольний клуб чи літній табір.'
              : 'Спробуйте змінити фільтри.'
          }
          action={
            canEdit &&
            projects.length === 0 && (
              <Button onClick={() => navigate('/projects/new')}>
                <Plus size={16} /> Додати проєкт
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => {
            const progress =
              project.is_fundraiser && project.goal_amount
                ? Math.min(100, ((project.current_amount ?? 0) / project.goal_amount) * 100)
                : null;
            return (
              <Card key={project.id} className="flex flex-col gap-3 p-0 transition-shadow hover:shadow-card-hover">
                {project.cover_image ? (
                  <img
                    src={project.cover_image}
                    alt=""
                    className="h-36 w-full rounded-t-card object-cover"
                  />
                ) : (
                  <div className="flex h-36 w-full items-center justify-center rounded-t-card bg-navy-50 text-4xl">
                    {project.icon || '📁'}
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-2.5 p-5 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="navy">
                      {project.icon && <span>{project.icon}</span>}
                      {project.category}
                    </Badge>
                    <Badge tone={STATUS_TONES[project.status]}>
                      {PROJECT_STATUS_LABELS[project.status]}
                    </Badge>
                    <Badge tone={project.published ? 'success' : 'gold'}>
                      {project.published ? 'Опубліковано' : 'Чернетка'}
                    </Badge>
                  </div>
                  <h3 className="font-semibold leading-snug text-navy-700">{project.title}</h3>
                  <p className="line-clamp-2 text-sm text-mist-600">{project.short_description}</p>

                  {progress !== null && (
                    <div className="mt-1 space-y-1.5">
                      <div className="h-2 overflow-hidden rounded-full bg-mist-200">
                        <div
                          className="h-full rounded-full bg-gold-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-gold-700">
                          {formatUah(project.current_amount ?? 0)} з{' '}
                          {formatUah(project.goal_amount ?? 0)}
                        </span>
                        <span className={cn('inline-flex items-center gap-1 text-mist-600')}>
                          <HandCoins size={12} /> {project.donors_count ?? 0} донорів
                        </span>
                      </div>
                    </div>
                  )}

                  {canEdit && (
                    <div className="mt-auto flex gap-2 border-t border-mist-100 pt-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/projects/${project.id}/edit`)}
                      >
                        <Pencil size={14} /> Редагувати
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => setDeleteTarget(project)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title="Видалити проєкт?"
        message={`«${deleteTarget?.title}» буде видалено назавжди.`}
        loading={deleting}
      />
    </div>
  );
}
