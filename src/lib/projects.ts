import type { Json, Tables } from './database.types';

/**
 * Publish-completeness contract for public.projects.
 *
 * This mirrors wise-step.org's own defensive rendering. Keep the two ends
 * IDENTICAL — if the site changes what counts as a renderable project, change it
 * here too, or the admin's "publishable" judgement will drift from what the site
 * can actually display.
 */

type Project = Tables<'projects'>;

/** The presentation sub-fields the completeness check reads. */
export interface ProjectPresentation {
  popup_details?: Array<[string, string]>;
  donate_title?: string;
  donate_btn?: string;
  donate_note?: string;
  color_class?: string;
  gradient_emoji?: string;
  preset_amounts?: string[];
  preset_active_idx?: number;
  success?: { emoji?: string; title?: string; text?: string };
  cta_details_action?: string;
  [key: string]: Json | undefined;
}

export function parsePresentation(json: Json | null | undefined): ProjectPresentation {
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    return json as ProjectPresentation;
  }
  return {};
}

/**
 * A donate URL is invalid when it is empty/null or is the shared placeholder jar
 * (`https://send.monobank.ua/jar/example`). Matched by substring so any host/path
 * variant of the literal `/jar/example` placeholder is rejected.
 */
export function isPlaceholderDonateUrl(url: string | null | undefined): boolean {
  const trimmed = (url ?? '').trim();
  if (!trimmed) return true;
  return trimmed.includes('/jar/example');
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Reasons a project cannot be published, in Ukrainian for direct display in the
 * admin. Empty array ⇒ the project passes the gate.
 *
 * Note: `gradient_emoji` is intentionally NOT required — several live projects
 * ship it as "" (empty). Only its presence-as-a-concept matters, not a value.
 */
export function getPublishBlockers(
  project: Pick<Project, 'slug' | 'title' | 'full_description' | 'external_donate_url'> & {
    presentation: Json;
  },
): string[] {
  const blockers: string[] = [];
  const p = parsePresentation(project.presentation);

  if (!isNonEmpty(project.slug)) {
    blockers.push('Вкажіть slug (посилання-ключ проєкту).');
  }

  const full = (project.full_description ?? '').trim();
  if (!full) {
    blockers.push('Додайте повний опис проєкту.');
  } else if (full === project.title.trim()) {
    blockers.push('Повний опис не може дублювати назву — додайте справжній текст.');
  }

  if (!Array.isArray(p.popup_details) || p.popup_details.length === 0) {
    blockers.push('Додайте хоча б один рядок деталей (popup_details).');
  }
  if (!isNonEmpty(p.donate_title)) {
    blockers.push('Вкажіть заголовок блоку донату (donate_title).');
  }
  if (!isNonEmpty(p.donate_btn)) {
    blockers.push('Вкажіть текст кнопки донату (donate_btn).');
  }
  if (!isNonEmpty(p.color_class)) {
    blockers.push('Оберіть кольорову тему (color_class).');
  }

  if (isPlaceholderDonateUrl(project.external_donate_url)) {
    blockers.push('Вкажіть справжнє посилання на банку (не приклад «/jar/example»).');
  }

  return blockers;
}
