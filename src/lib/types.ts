import type { Json, Tables } from './database.types';

/* ---------- Form builder domain types (stored in forms.schema / forms.style) ---------- */

export type FormFieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'number'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'file';

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  /** Options for select / radio / checkbox fields */
  options?: string[];
}

export interface FormSchema {
  fields: FormField[];
}

/** A document the admin attaches to a form (rules, blank application) for visitors to download. */
export interface FormAttachment {
  id: string;
  /** Public URL in the `media` bucket */
  url: string;
  /** Original file name shown to the visitor */
  name: string;
  /** Bytes, for the size hint next to the name */
  size?: number;
}

export interface FormStyle {
  accentColor: string;
  showLogo: boolean;
  description?: string;
  coverImage?: string;
  attachments: FormAttachment[];
}

export const DEFAULT_FORM_STYLE: FormStyle = {
  accentColor: '#01B5B4',
  showLogo: true,
  attachments: [],
};

export function parseFormSchema(json: Json): FormSchema {
  const value = json as unknown;
  if (
    value &&
    typeof value === 'object' &&
    Array.isArray((value as { fields?: unknown }).fields)
  ) {
    return value as unknown as FormSchema;
  }
  return { fields: [] };
}

/** Forms saved before attachments existed have no `attachments` key, so narrow defensively. */
function parseFormAttachments(value: unknown): FormAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is FormAttachment => {
    if (!item || typeof item !== 'object') return false;
    const a = item as Partial<FormAttachment>;
    return typeof a.url === 'string' && typeof a.name === 'string' && typeof a.id === 'string';
  });
}

export function parseFormStyle(json: Json): FormStyle {
  const value = json as unknown;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const style = { ...DEFAULT_FORM_STYLE, ...(value as Partial<FormStyle>) };
    return { ...style, attachments: parseFormAttachments(style.attachments) };
  }
  return { ...DEFAULT_FORM_STYLE };
}

/* ---------- Quiz game domain types ---------- */

/** A question as broadcast to players — deliberately excludes correct_indexes. */
export interface LiveQuestion {
  text: string;
  options: string[];
  timeLimitSeconds: number;
  points: number;
  /** Whether more than one answer must be selected */
  multiple: boolean;
}

/** Strips a quiz_questions row down to what players may see. */
export function toLiveQuestion(row: Tables<'quiz_questions'>): LiveQuestion {
  return {
    text: row.question_text,
    options: Array.isArray(row.options) ? (row.options as string[]) : [],
    timeLimitSeconds: row.time_limit_seconds,
    points: row.points,
    multiple: row.correct_indexes.length > 1,
  };
}

export interface LeaderboardEntry {
  playerId: string;
  nickname: string;
  score: number;
  /** Points gained on the last question (for deltas) */
  lastGain: number;
}

/* Realtime protocol — everything flows through one channel per room: `game:{room_code}`.
 * The host is authoritative: it owns the timer, scoring, and all DB writes.
 * Players only ever send `answer` and `hello`. */

export type HostBroadcast =
  | {
      type: 'lobby';
      quizTitle: string;
      questionCount: number;
    }
  | {
      type: 'question';
      index: number;
      total: number;
      question: LiveQuestion;
      /** Epoch ms when answering closes; players sync their countdown to this */
      endsAt: number;
      /** Epoch ms when the question was shown (for latency-tolerant scoring on host) */
      startedAt: number;
    }
  | {
      /** Lightweight live tick while a question is open — powers "X answered" counters */
      type: 'progress';
      index: number;
      answered: number;
      totalPlayers: number;
    }
  | {
      type: 'reveal';
      index: number;
      /**
       * Question and total are repeated here so the reveal stands alone: on `hello` the host
       * replays only the last broadcast, so a client that reloads mid-reveal never sees the
       * preceding `question` message.
       */
      total: number;
      question: LiveQuestion;
      correctIndexes: number[];
      /** Answer count per option index */
      tallies: number[];
      leaderboard: LeaderboardEntry[];
    }
  | {
      type: 'gameover';
      podium: LeaderboardEntry[];
    }
  | {
      /** Host confirms a name change (asked for by the player, or done by the host itself) */
      type: 'renamed';
      playerId: string;
      nickname: string;
    };

export type PlayerBroadcast =
  | {
      type: 'answer';
      playerId: string;
      nickname: string;
      questionIndex: number;
      selected: number[];
      /** ms elapsed since the player saw the question, by their own clock */
      elapsedMs: number;
    }
  | {
      /** Sent on (re)connect so the host re-broadcasts current state */
      type: 'hello';
      playerId: string;
      nickname: string;
    }
  | {
      /** Asks the host to change this player's display name. Honoured in the lobby only. */
      type: 'rename';
      playerId: string;
      nickname: string;
    };

export interface PresenceMeta {
  playerId: string;
  nickname: string;
}

export const GAME_EVENT = 'game'; // host -> players
export const PLAYER_EVENT = 'player'; // players -> host

export function gameChannelName(roomCode: string): string {
  return `game:${roomCode}`;
}

/** Every nickname write goes through here — the DB checks char_length between 1 and 24. */
export function sanitizeNickname(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, 24).trim();
}

/** Kahoot-style speed scoring: full points instantly, floor of 50% at the buzzer. */
export function computeScore(points: number, elapsedMs: number, timeLimitSeconds: number): number {
  const ratio = Math.min(1, Math.max(0, elapsedMs / (timeLimitSeconds * 1000)));
  return Math.round(points * (1 - ratio / 2));
}

export function sameAnswerSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

/* ---------- Projects ---------- */

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  ongoing: 'Постійний',
  one_time: 'Разовий',
  campaign: 'Кампанія',
};

// Live lifecycle shown on wise-step.org (distinct from the status "kind" above).
export const PROJECT_LIFECYCLE_LABELS: Record<string, string> = {
  active: 'Активний',
  upcoming: 'Незабаром',
};

// Gradient theme classes used by the public site's project cards/popups
// (presentation.color_class). Values transcribed from the live seed.
export const COLOR_CLASS_OPTIONS: { value: string; label: string }[] = [
  { value: 'g-teal', label: 'Бірюзовий' },
  { value: 'g-warm', label: 'Теплий' },
  { value: 'g-pink', label: 'Рожевий' },
  { value: 'g-olive', label: 'Оливковий' },
  { value: 'g-blue', label: 'Синій' },
  { value: 'g-yellow', label: 'Жовтий' },
  { value: 'g-orange', label: 'Помаранчевий' },
  { value: 'g-purple', label: 'Фіолетовий' },
  { value: 'g-navy', label: 'Темно-синій' },
  { value: 'g-green', label: 'Зелений' },
  { value: 'g-tan', label: 'Пісочний' },
];

/* ---------- Roles ---------- */

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Суперадмін',
  editor: 'Редактор',
  viewer: 'Спостерігач',
};
