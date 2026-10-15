import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FlaskConical, RotateCcw, X } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { ROLE_LABELS } from '@/lib/types';
import type { Role } from '@/lib/database.types';
import { resetDb } from './db';
import { signInAsRole } from './client';

const ROLES: Role[] = ['super_admin', 'editor', 'viewer'];

/**
 * Floating demo-mode panel: says the data is fictional, lets a visitor switch role to see how
 * permissions change the UI, and restores the seed dataset.
 */
export function DemoBanner() {
  const { session, role } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(() => window.innerWidth >= 768);

  // Keep the player phone UI and the projector view unobstructed.
  if (pathname.startsWith('/play') || pathname.startsWith('/screen')) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 flex size-11 items-center justify-center rounded-full bg-gold-500 text-navy-800 shadow-card-hover"
        aria-label="Показати панель демо-режиму"
      >
        <FlaskConical size={20} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-navy-800/95 p-4 text-sm text-white shadow-card-hover backdrop-blur">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="flex items-center gap-2 font-bold text-gold-300">
          <FlaskConical size={16} /> Демо-режим
        </p>
        <button
          onClick={() => setOpen(false)}
          className="-m-1 rounded-lg p-1 text-navy-200 hover:bg-white/10 hover:text-white"
          aria-label="Згорнути"
        >
          <X size={16} />
        </button>
      </div>
      <p className="text-xs leading-relaxed text-navy-100">
        Усі дані вигадані й зберігаються лише у вашому браузері. Створюйте, редагуйте й видаляйте
        що завгодно. Квіз можна провести наживо: до кімнати приєднаються боти, а грати самому
        можна у сусідній вкладці.
      </p>
      {session && (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-navy-300">
            Подивитися як
          </p>
          <div className="flex gap-1.5">
            {ROLES.map((r) => (
              <button
                key={r}
                onClick={() => signInAsRole(r)}
                className={
                  r === role
                    ? 'flex-1 rounded-lg bg-teal-500 px-2 py-1.5 text-xs font-semibold text-white'
                    : 'flex-1 rounded-lg bg-white/10 px-2 py-1.5 text-xs font-semibold text-navy-100 hover:bg-white/20'
                }
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={() => {
          resetDb();
          window.location.reload();
        }}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-teal-300 hover:underline"
      >
        <RotateCcw size={12} /> Скинути демо-дані
      </button>
    </div>
  );
}
