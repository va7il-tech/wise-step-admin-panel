import { useState } from 'react';
import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Gamepad2,
  FolderHeart,
  Users,
  LogOut,
  Menu,
  X,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { ChangePasswordModal } from '@/features/auth/ChangePasswordModal';
import { Spinner } from './ui';
import { cn } from '@/lib/utils';
import { ROLE_LABELS } from '@/lib/types';

const NAV_ITEMS = [
  { to: '/', label: 'Огляд', icon: LayoutDashboard, end: true },
  { to: '/forms', label: 'Форми', icon: FileText },
  { to: '/games', label: 'Ігри', icon: Gamepad2 },
  { to: '/projects', label: 'Проєкти', icon: FolderHeart },
  { to: '/users', label: 'Користувачі', icon: Users, superAdminOnly: true },
];

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { canManageUsers } = useAuth();
  return (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV_ITEMS.filter((item) => !item.superAdminOnly || canManageUsers).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-teal-500/15 text-teal-300'
                : 'text-navy-100 hover:bg-white/5 hover:text-white',
            )
          }
        >
          <item.icon size={18} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { profile, role, signOut } = useAuth();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex items-center gap-3 px-1 pt-1">
        <img src="/logo.svg" alt="" className="size-9 rounded-xl" />
        <div>
          <p className="text-sm font-bold text-white">Wise Step</p>
          <p className="text-[11px] text-navy-300">Адмін-панель</p>
        </div>
      </div>
      <NavItems onNavigate={onNavigate} />
      <div className="border-t border-white/10 pt-3">
        <div className="mb-2 px-1">
          <p className="truncate text-sm font-medium text-white">
            {profile?.full_name || profile?.email || '—'}
          </p>
          <p className="text-[11px] text-teal-300">{role ? ROLE_LABELS[role] : ''}</p>
        </div>
        <button
          onClick={() => setChangePasswordOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-navy-100 transition-colors hover:bg-white/5 hover:text-white"
        >
          <KeyRound size={18} />
          Змінити пароль
        </button>
        <button
          onClick={() => void signOut()}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-navy-100 transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogOut size={18} />
          Вийти
        </button>
      </div>
      <ChangePasswordModal open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
    </div>
  );
}

export function AdminLayout() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner label="Завантаження…" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-navy-700 lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-navy-700 px-4 lg:hidden">
        <div className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="" className="size-8 rounded-lg" />
          <span className="text-sm font-bold text-white">Wise Step</span>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="rounded-lg p-2 text-white hover:bg-white/10"
          aria-label="Відкрити меню"
        >
          <Menu size={22} />
        </button>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-navy-700 shadow-card-hover">
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-2 text-navy-200 hover:bg-white/10 hover:text-white"
              aria-label="Закрити меню"
            >
              <X size={20} />
            </button>
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
