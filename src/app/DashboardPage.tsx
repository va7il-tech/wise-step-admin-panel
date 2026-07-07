import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, FolderHeart, Gamepad2, Users, type LucideIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, PageHeader } from '@/components/ui';

interface Stats {
  activeForms: number;
  liveSessions: number;
  activeProjects: number;
  totalUsers: number;
}

const CARDS: Array<{
  key: keyof Stats;
  label: string;
  to: string;
  icon: LucideIcon;
  accent: string;
}> = [
  { key: 'activeForms', label: 'Опубліковані форми', to: '/forms', icon: FileText, accent: 'bg-teal-50 text-teal-600' },
  { key: 'liveSessions', label: 'Активні ігри', to: '/games', icon: Gamepad2, accent: 'bg-gold-100 text-gold-700' },
  { key: 'activeProjects', label: 'Проєкти', to: '/projects', icon: FolderHeart, accent: 'bg-navy-50 text-navy-600' },
  { key: 'totalUsers', label: 'Користувачі', to: '/users', icon: Users, accent: 'bg-success-50 text-success-700' },
];

export function DashboardPage() {
  const { profile, canManageUsers } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    void (async () => {
      const [forms, sessions, projects, users] = await Promise.all([
        supabase.from('forms').select('id', { count: 'exact', head: true }).eq('is_published', true),
        supabase
          .from('game_sessions')
          .select('id', { count: 'exact', head: true })
          .in('status', ['lobby', 'active']),
        supabase.from('projects').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
      ]);
      setStats({
        activeForms: forms.count ?? 0,
        liveSessions: sessions.count ?? 0,
        activeProjects: projects.count ?? 0,
        totalUsers: users.count ?? 0,
      });
    })();
  }, []);

  const greetingName = profile?.full_name?.split(' ')[0];

  return (
    <div>
      <PageHeader
        title={greetingName ? `Вітаємо, ${greetingName}!` : 'Вітаємо!'}
        subtitle="Огляд активності Wise Step"
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {CARDS.filter((c) => c.key !== 'totalUsers' || canManageUsers).map((card) => (
          <Link key={card.key} to={card.to}>
            <Card className="flex h-full flex-col gap-3 transition-shadow hover:shadow-card-hover">
              <span className={`flex size-10 items-center justify-center rounded-xl ${card.accent}`}>
                <card.icon size={20} />
              </span>
              <div>
                <p className="text-3xl font-black text-navy-700">
                  {stats ? stats[card.key] : '–'}
                </p>
                <p className="mt-0.5 text-sm text-mist-600">{card.label}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-semibold text-navy-700">Швидкий старт</h2>
          <ul className="space-y-2 text-sm text-mist-600">
            <li>
              <Link to="/forms/new" className="font-medium text-teal-600 hover:text-teal-700">
                Створити форму реєстрації
              </Link>{' '}
              — для табору, гуртка чи події.
            </li>
            <li>
              <Link to="/games/new" className="font-medium text-teal-600 hover:text-teal-700">
                Створити квіз
              </Link>{' '}
              — і провести гру наживо з QR-кодом для приєднання.
            </li>
            <li>
              <Link to="/projects/new" className="font-medium text-teal-600 hover:text-teal-700">
                Додати проєкт
              </Link>{' '}
              — з описом, галереєю та збором коштів.
            </li>
          </ul>
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold text-navy-700">Про панель</h2>
          <p className="text-sm text-mist-600">
            Це адміністративна панель центру розвитку дітей та молоді «Wise Step» (м. Свалява).
            Тут команда керує реєстраційними формами, інтерактивними іграми, проєктами та
            доступом користувачів.
          </p>
        </Card>
      </div>
    </div>
  );
}
