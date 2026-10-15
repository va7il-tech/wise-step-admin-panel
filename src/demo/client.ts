/**
 * A Supabase-shaped client backed entirely by the browser, for the public portfolio demo.
 * Enabled by VITE_DEMO_MODE=true (see lib/supabase.ts); production builds never touch it.
 */
import type { Session } from '@supabase/supabase-js';
import { DemoQuery, loadDb, onTableInsert, readSession, saveDb, storeSession, type TableName } from './db';
import { DemoChannel } from './realtime';
import { spawnBots } from './bots';
import type { Role } from '@/lib/database.types';

export const DEMO_PASSWORD = 'demo1234';
export const DEMO_ADMIN_EMAIL = 'admin@demo.wise-step.org';

/* ---------- auth ---------- */

type AuthListener = (event: string, session: Session | null) => void;
const authListeners = new Set<AuthListener>();

function makeSession(user: { id: string; email: string | null }): Session {
  return {
    access_token: 'demo-access-token',
    refresh_token: 'demo-refresh-token',
    token_type: 'bearer',
    expires_in: 60 * 60 * 24 * 365,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    user: {
      id: user.id,
      email: user.email ?? undefined,
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  } as Session;
}

function setSession(session: Session | null, event: string) {
  storeSession(session);
  for (const listener of authListeners) listener(event, session);
}

const ok = <T>(data: T) => Promise.resolve({ data, error: null });

const auth = {
  getSession: () => ok({ session: readSession<Session>() }),

  onAuthStateChange(listener: AuthListener) {
    authListeners.add(listener);
    return { data: { subscription: { unsubscribe: () => authListeners.delete(listener) } } };
  },

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    await new Promise((r) => setTimeout(r, 350));
    const profile = loadDb().profiles.find((p) => p.email?.toLowerCase() === email.trim().toLowerCase());
    if (!profile || password !== DEMO_PASSWORD) {
      return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } };
    }
    const session = makeSession(profile);
    setSession(session, 'SIGNED_IN');
    return { data: { user: session.user, session }, error: null };
  },

  async signOut() {
    setSession(null, 'SIGNED_OUT');
    return { error: null };
  },

  updateUser: () => ok({ user: readSession<Session>()?.user ?? null }),
  resetPasswordForEmail: () => ok({}),
};

/** Instant persona switch used by the demo banner (same as logging in with that account). */
export function signInAsRole(role: Role): void {
  const profile = loadDb().profiles.find((p) => p.role === role);
  if (profile) setSession(makeSession(profile), 'SIGNED_IN');
}

/* ---------- storage ---------- */

/** Uploaded files by storage path. Small files become data URLs so they survive a reload. */
const uploads = new Map<string, string>();

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const storage = {
  from(bucket: string) {
    const key = (path: string) => `${bucket}/${path}`;
    return {
      async upload(path: string, file: File) {
        const url = file.size <= 1.5 * 1024 * 1024 ? await readAsDataUrl(file) : URL.createObjectURL(file);
        uploads.set(key(path), url);
        return { data: { path }, error: null };
      },
      getPublicUrl(path: string) {
        return { data: { publicUrl: uploads.get(key(path)) ?? `/demo/${path.split('/').pop()}` } };
      },
      createSignedUrl(path: string) {
        // Seeded submissions reference files shipped in /public/demo.
        return ok({ signedUrl: uploads.get(key(path)) ?? `/demo/${path.split('/').pop()}` });
      },
    };
  },
};

/* ---------- edge function: admin-users ---------- */

interface AdminUsersBody {
  action: 'invite' | 'revoke';
  email?: string;
  fullName?: string;
  role?: Role;
  userId?: string;
}

const functions = {
  async invoke(name: string, { body }: { body: AdminUsersBody }) {
    await new Promise((r) => setTimeout(r, 500));
    if (name !== 'admin-users') return { data: null, error: { message: `Unknown function ${name}` } };
    const db = loadDb();
    const me = readSession<Session>()?.user.id;
    if (db.profiles.find((p) => p.id === me)?.role !== 'super_admin') {
      return { data: { error: 'Лише суперадмін може керувати користувачами' }, error: null };
    }
    if (body.action === 'invite') {
      const email = body.email?.trim().toLowerCase() ?? '';
      if (db.profiles.some((p) => p.email?.toLowerCase() === email)) {
        return { data: { error: 'Користувач із такою поштою вже існує' }, error: null };
      }
      db.profiles.push({
        id: crypto.randomUUID(),
        email,
        full_name: body.fullName?.trim() || null,
        role: body.role ?? 'viewer',
        created_at: new Date().toISOString(),
      });
      saveDb(db);
      return { data: { ok: true }, error: null };
    }
    if (body.userId === me) {
      return { data: { error: 'Не можна відкликати доступ у самого себе' }, error: null };
    }
    db.profiles = db.profiles.filter((p) => p.id !== body.userId);
    saveDb(db);
    return { data: { ok: true }, error: null };
  },
};

/* ---------- client ---------- */

// A newly opened room gets bot players, but only in the tab that opened it.
onTableInsert((table, rows) => {
  if (table !== 'game_sessions') return;
  for (const row of rows) spawnBots(row.id as string, row.room_code as string);
});

export function createDemoClient() {
  return {
    from: (table: TableName) => new DemoQuery(table),
    auth,
    storage,
    functions,
    channel: (topic: string) => new DemoChannel(topic),
    removeChannel: (channel: DemoChannel) => channel.unsubscribe(),
  };
}
