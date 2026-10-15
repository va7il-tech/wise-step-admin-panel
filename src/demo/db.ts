/**
 * In-browser stand-in for the Supabase database, used only in demo mode (VITE_DEMO_MODE=true).
 *
 * Tables live in localStorage so every tab of the same browser shares one dataset — that is what
 * lets a host tab, a player tab and the big screen run a live quiz together without a backend.
 * The query builder implements exactly the PostgREST surface the app uses (see `grep supabase.`),
 * not the whole API.
 */
import type { Database, Role } from '@/lib/database.types';
import { buildSeed } from './seed';

type Tables = Database['public']['Tables'];
export type TableName = keyof Tables;
type Row = Record<string, unknown>;
export type DemoDb = { [K in TableName]: Tables[K]['Row'][] };

const DB_KEY = 'wisestep-demo-db-v1';
const SESSION_KEY = 'wisestep-demo-session-v1';

/* ---------- storage ---------- */

let memoryDb: DemoDb | null = null;

export function loadDb(): DemoDb {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      memoryDb = JSON.parse(raw) as DemoDb;
      return memoryDb;
    }
  } catch {
    // Private mode / blocked storage — fall through to the in-memory copy.
  }
  if (!memoryDb) {
    memoryDb = buildSeed();
    saveDb(memoryDb);
  }
  return memoryDb;
}

export function saveDb(db: DemoDb): void {
  memoryDb = db;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    // Quota exceeded (large uploaded images) — this tab keeps working from memory.
  }
}

export function resetDb(): void {
  memoryDb = buildSeed();
  saveDb(memoryDb);
}

/* ---------- current demo user (drives the RLS imitation below) ---------- */

export function currentUserId(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? ((JSON.parse(raw) as { user: { id: string } }).user.id ?? null) : null;
  } catch {
    return null;
  }
}

export function storeSession(session: unknown): void {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function readSession<T>(): T | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function currentRole(db: DemoDb): Role | null {
  const id = currentUserId();
  return db.profiles.find((p) => p.id === id)?.role ?? null;
}

/** Tables anonymous visitors may insert into (public form + joining a game). */
const ANON_INSERT: TableName[] = ['form_submissions', 'game_players'];

function permissionError(db: DemoDb, table: TableName, op: 'insert' | 'update' | 'delete') {
  if (op === 'insert' && ANON_INSERT.includes(table)) return null;
  const role = currentRole(db);
  const allowed = table === 'profiles' ? role === 'super_admin' : role === 'super_admin' || role === 'editor';
  return allowed
    ? null
    : {
        code: '42501',
        message: 'Демо: роль «Спостерігач» має доступ лише на читання (так само працює RLS у продакшні)',
        details: '',
        hint: '',
      };
}

/* ---------- schema knowledge ---------- */

const now = () => new Date().toISOString();

function withDefaults(table: TableName, input: Row): Row {
  const base: Row = { id: crypto.randomUUID(), ...input };
  switch (table) {
    case 'forms':
      return { style: {}, is_published: false, created_by: null, created_at: now(), updated_at: now(), ...base };
    case 'form_submissions':
      return { submitted_at: now(), ...base };
    case 'quizzes':
      return { cover_image: null, created_by: null, created_at: now(), ...base };
    case 'quiz_questions':
      return { time_limit_seconds: 20, points: 1000, ...base };
    case 'game_sessions':
      return { status: 'lobby', current_question_index: 0, started_at: null, created_at: now(), ...base };
    case 'game_players':
      return { score: 0, joined_at: now(), ...base };
    case 'game_answers':
      return { answered_at: now(), points_awarded: 0, ...base };
    case 'profiles':
      return { full_name: null, email: null, role: 'viewer', created_at: now(), ...base };
    case 'projects':
      return {
        icon: null, full_description: null, read_more: null, cover_image: null, gallery: [], tags: [],
        status: 'ongoing', is_fundraiser: false, goal_amount: null, current_amount: null, donors_count: null,
        external_donate_url: null, slug: null, sort_order: 0, featured: false, published: false, badge: null,
        lifecycle: null, main_image_alt: null, currency: 'грн', progress_visible: false, progress_percent: null,
        amount_left: null, deadline_days: null, presentation: {}, created_by: null, created_at: now(),
        updated_at: now(), ...base,
      };
  }
}

/** Unique columns, checked on insert/update so the app's 23505 handling is exercised. */
const UNIQUE: Partial<Record<TableName, string[]>> = {
  forms: ['slug'],
  projects: ['slug'],
  game_sessions: ['room_code'],
};

/** Embedded `child(count)` selects: parent table → child table → FK column on the child. */
const EMBEDS: Partial<Record<TableName, Partial<Record<TableName, string>>>> = {
  forms: { form_submissions: 'form_id' },
  quizzes: { quiz_questions: 'quiz_id' },
};

/** ON DELETE CASCADE chains from the migrations. */
const CASCADES: Partial<Record<TableName, Array<[TableName, string]>>> = {
  forms: [['form_submissions', 'form_id']],
  quizzes: [['quiz_questions', 'quiz_id'], ['game_sessions', 'quiz_id']],
  game_sessions: [['game_players', 'session_id'], ['game_answers', 'session_id']],
  game_players: [['game_answers', 'player_id']],
};

function setRows(db: DemoDb, table: TableName, rows: Row[]): void {
  (db as unknown as Record<TableName, Row[]>)[table] = rows;
}

function cascadeDelete(db: DemoDb, table: TableName, ids: unknown[]): void {
  for (const [child, fk] of CASCADES[table] ?? []) {
    const rows = db[child] as unknown as Row[];
    const doomed = rows.filter((r) => ids.includes(r[fk])).map((r) => r.id);
    setRows(db, child, rows.filter((r) => !ids.includes(r[fk])));
    if (doomed.length) cascadeDelete(db, child, doomed);
  }
}

/* ---------- query builder ---------- */

type Filter = (row: Row) => boolean;
type Op = 'select' | 'insert' | 'update' | 'delete';

interface PgError {
  code: string;
  message: string;
  details: string;
  hint: string;
}

export interface DemoResult {
  data: unknown;
  error: PgError | null;
  count: number | null;
  status: number;
  statusText: string;
}

/** Small artificial latency so loading states behave like they do against the real API. */
const latency = () => new Promise((r) => setTimeout(r, 60 + Math.random() * 140));

export class DemoQuery implements PromiseLike<DemoResult> {
  private op: Op = 'select';
  private filters: Filter[] = [];
  private orders: Array<{ column: string; ascending: boolean }> = [];
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private columns = '*';
  private returning = false;
  private countMode = false;
  private head = false;
  private cardinality: 'many' | 'single' | 'maybe' = 'many';
  private payload: Row | Row[] | null = null;

  constructor(private readonly table: TableName) {}

  select(columns = '*', options?: { count?: 'exact'; head?: boolean }) {
    this.columns = columns;
    if (this.op !== 'select') this.returning = true;
    if (options?.count) this.countMode = true;
    if (options?.head) this.head = true;
    return this;
  }
  insert(values: Row | Row[]) {
    this.op = 'insert';
    this.payload = values;
    return this;
  }
  update(values: Row) {
    this.op = 'update';
    this.payload = values;
    return this;
  }
  delete() {
    this.op = 'delete';
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push((r) => r[column] === value);
    return this;
  }
  neq(column: string, value: unknown) {
    this.filters.push((r) => r[column] !== value);
    return this;
  }
  in(column: string, values: unknown[]) {
    this.filters.push((r) => values.includes(r[column]));
    return this;
  }
  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending ?? true });
    return this;
  }
  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }
  limit(n: number) {
    this.rangeFrom = 0;
    this.rangeTo = n - 1;
    return this;
  }
  single() {
    this.cardinality = 'single';
    return this;
  }
  maybeSingle() {
    this.cardinality = 'maybe';
    return this;
  }

  then<A = DemoResult, B = never>(
    onFulfilled?: ((value: DemoResult) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return latency()
      .then(() => this.execute())
      .then(onFulfilled, onRejected);
  }

  private matches(row: Row) {
    return this.filters.every((f) => f(row));
  }

  private project(db: DemoDb, row: Row): Row {
    if (this.columns.trim() === '*') return { ...row };
    const out: Row = {};
    for (const part of this.columns.split(',').map((s) => s.trim()).filter(Boolean)) {
      const embed = /^(\w+)\(count\)$/.exec(part);
      if (embed) {
        const child = embed[1] as TableName;
        const fk = EMBEDS[this.table]?.[child];
        const n = fk ? (db[child] as unknown as Row[]).filter((c) => c[fk] === row.id).length : 0;
        out[child] = [{ count: n }];
      } else if (part === '*') {
        Object.assign(out, row);
      } else {
        out[part] = row[part];
      }
    }
    return out;
  }

  private result(data: unknown, count: number | null = null, error: PgError | null = null): DemoResult {
    return { data, error, count, status: error ? 400 : 200, statusText: error ? 'Bad Request' : 'OK' };
  }

  private shape(db: DemoDb, rows: Row[], count: number | null): DemoResult {
    if (this.head) return this.result(null, count);
    const projected = rows.map((r) => this.project(db, r));
    if (this.cardinality === 'many') return this.result(projected, count);
    if (projected.length === 1) return this.result(projected[0], count);
    if (this.cardinality === 'maybe' && projected.length === 0) return this.result(null, count);
    return this.result(null, count, {
      code: 'PGRST116',
      message: 'JSON object requested, multiple (or no) rows returned',
      details: `The result contains ${projected.length} rows`,
      hint: '',
    });
  }

  private uniqueViolation(db: DemoDb, candidate: Row, ignoreId?: unknown): PgError | null {
    for (const column of UNIQUE[this.table] ?? []) {
      const value = candidate[column];
      if (value === null || value === undefined) continue;
      const clash = (db[this.table] as unknown as Row[]).some((r) => r.id !== ignoreId && r[column] === value);
      if (clash) {
        return {
          code: '23505',
          message: `duplicate key value violates unique constraint "${this.table}_${column}_key"`,
          details: '',
          hint: '',
        };
      }
    }
    return null;
  }

  private execute(): DemoResult {
    const db = loadDb();
    const table = db[this.table] as unknown as Row[];

    if (this.op === 'select') {
      let rows = table.filter((r) => this.matches(r));
      for (const { column, ascending } of [...this.orders].reverse()) {
        rows = [...rows].sort((a, b) => {
          const av = a[column] as string | number;
          const bv = b[column] as string | number;
          if (av === bv) return 0;
          return (av > bv ? 1 : -1) * (ascending ? 1 : -1);
        });
      }
      const count = this.countMode ? rows.length : null;
      if (this.rangeFrom !== null && this.rangeTo !== null) rows = rows.slice(this.rangeFrom, this.rangeTo + 1);
      return this.shape(db, rows, count);
    }

    const denied = permissionError(db, this.table, this.op);
    if (denied) return this.result(null, null, denied);

    if (this.op === 'insert') {
      const inputs = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
      const created: Row[] = [];
      for (const input of inputs) {
        const row = withDefaults(this.table, input);
        const clash = this.uniqueViolation(db, row);
        if (clash) return this.result(null, null, clash);
        table.push(row);
        created.push(row);
      }
      saveDb(db);
      onInsert(this.table, created);
      return this.returning ? this.shape(db, created, null) : this.result(null, null);
    }

    if (this.op === 'update') {
      const patch = { ...(this.payload as Row) };
      if (this.table === 'forms' || this.table === 'projects') patch.updated_at = now();
      const touched: Row[] = [];
      for (let i = 0; i < table.length; i++) {
        const current = table[i]!;
        if (!this.matches(current)) continue;
        const next = { ...current, ...patch };
        const clash = this.uniqueViolation(db, next, current.id);
        if (clash) return this.result(null, null, clash);
        table[i] = next;
        touched.push(next);
      }
      saveDb(db);
      return this.returning ? this.shape(db, touched, null) : this.result(null, null);
    }

    // delete
    const doomed = table.filter((r) => this.matches(r));
    setRows(db, this.table, table.filter((r) => !this.matches(r)));
    cascadeDelete(db, this.table, doomed.map((r) => r.id));
    saveDb(db);
    return this.returning ? this.shape(db, doomed, null) : this.result(null, null);
  }
}

/* ---------- insert hooks (bots join freshly opened game rooms) ---------- */

type InsertListener = (table: TableName, rows: Row[]) => void;
const insertListeners = new Set<InsertListener>();

export function onTableInsert(listener: InsertListener): void {
  insertListeners.add(listener);
}

function onInsert(table: TableName, rows: Row[]) {
  for (const listener of insertListeners) listener(table, rows);
}
