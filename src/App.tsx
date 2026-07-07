import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { AdminLayout } from '@/components/AdminLayout';
import { Spinner } from '@/components/ui';

const LoginPage = lazy(() =>
  import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const DashboardPage = lazy(() =>
  import('@/app/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const FormsListPage = lazy(() =>
  import('@/features/forms/FormsListPage').then((m) => ({ default: m.FormsListPage })),
);
const FormEditorPage = lazy(() =>
  import('@/features/forms/FormEditorPage').then((m) => ({ default: m.FormEditorPage })),
);
const FormResponsesPage = lazy(() =>
  import('@/features/forms/FormResponsesPage').then((m) => ({ default: m.FormResponsesPage })),
);
const PublicFormPage = lazy(() =>
  import('@/features/forms/PublicFormPage').then((m) => ({ default: m.PublicFormPage })),
);
const ProjectsListPage = lazy(() =>
  import('@/features/projects/ProjectsListPage').then((m) => ({ default: m.ProjectsListPage })),
);
const ProjectEditorPage = lazy(() =>
  import('@/features/projects/ProjectEditorPage').then((m) => ({ default: m.ProjectEditorPage })),
);
const QuizzesListPage = lazy(() =>
  import('@/features/games/QuizzesListPage').then((m) => ({ default: m.QuizzesListPage })),
);
const QuizEditorPage = lazy(() =>
  import('@/features/games/QuizEditorPage').then((m) => ({ default: m.QuizEditorPage })),
);
const HostSessionPage = lazy(() =>
  import('@/features/games/HostSessionPage').then((m) => ({ default: m.HostSessionPage })),
);
const BigScreenPage = lazy(() =>
  import('@/features/games/BigScreenPage').then((m) => ({ default: m.BigScreenPage })),
);
const PlayPage = lazy(() =>
  import('@/features/games/PlayPage').then((m) => ({ default: m.PlayPage })),
);
const UsersPage = lazy(() =>
  import('@/features/users/UsersPage').then((m) => ({ default: m.UsersPage })),
);

function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const { canManageUsers, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!canManageUsers) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Spinner label="Завантаження…" />}>
          <Routes>
            {/* Public surfaces — no auth */}
            <Route path="/f/:slug" element={<PublicFormPage />} />
            <Route path="/play" element={<PlayPage />} />
            <Route path="/play/:code" element={<PlayPage />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Projector view — authenticated, but outside the admin shell */}
            <Route path="/screen/:sessionId" element={<BigScreenPage />} />

            {/* Admin */}
            <Route element={<AdminLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="/forms" element={<FormsListPage />} />
              <Route path="/forms/new" element={<FormEditorPage />} />
              <Route path="/forms/:id/edit" element={<FormEditorPage />} />
              <Route path="/forms/:id/responses" element={<FormResponsesPage />} />
              <Route path="/projects" element={<ProjectsListPage />} />
              <Route path="/projects/new" element={<ProjectEditorPage />} />
              <Route path="/projects/:id/edit" element={<ProjectEditorPage />} />
              <Route path="/games" element={<QuizzesListPage />} />
              <Route path="/games/new" element={<QuizEditorPage />} />
              <Route path="/games/:id/edit" element={<QuizEditorPage />} />
              <Route path="/games/host/:sessionId" element={<HostSessionPage />} />
              <Route
                path="/users"
                element={
                  <RequireSuperAdmin>
                    <UsersPage />
                  </RequireSuperAdmin>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
