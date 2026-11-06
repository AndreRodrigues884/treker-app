// Saved workouts (workout_templates) and their ordered exercises (workout_template_exercises).
// Saving goes through Postgres save_workout_template: the template and its whole list in one
// request and one transaction, upserted by ids made on the phone, so "Try again" never
// duplicates.
import { toSavePayload, type TemplateDraft } from '@/core/templates';
import type { DataContext } from '@/lib/data/context';
import { throwIfError, unwrap, unwrapMaybe } from '@/lib/data/result';
import { supabase } from '@/lib/supabase/client';
import type { Tables } from '@/lib/supabase/database.types';

export type TemplateRow = Tables<'workout_templates'>;
export type TemplateExerciseRow = Tables<'workout_template_exercises'>;

export type TemplateWithExercises = {
  template: TemplateRow;
  // In position order, without deleted rows.
  exercises: TemplateExerciseRow[];
};

function byPosition(a: TemplateExerciseRow, b: TemplateExerciseRow): number {
  return a.position - b.position || (a.id < b.id ? -1 : 1);
}

// The athlete's templates (not deleted), most recently changed first, each with its exercises.
export async function listTemplates(ctx: DataContext): Promise<TemplateWithExercises[]> {
  const [templates, exercises] = await Promise.all([
    supabase
      .from('workout_templates')
      .select('*')
      .eq('user_id', ctx.userId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false }),
    supabase
      .from('workout_template_exercises')
      .select('*')
      .eq('user_id', ctx.userId)
      .is('deleted_at', null)
      .order('position', { ascending: true }),
  ]);
  const rows = unwrap(exercises);
  return unwrap(templates).map((template) => ({
    template,
    exercises: rows.filter((row) => row.template_id === template.id).sort(byPosition),
  }));
}

// One template with its exercises; null when missing or deleted.
export async function getTemplate(
  ctx: DataContext,
  id: string,
): Promise<TemplateWithExercises | null> {
  const [template, exercises] = await Promise.all([
    supabase
      .from('workout_templates')
      .select('*')
      .eq('id', id)
      .eq('user_id', ctx.userId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('workout_template_exercises')
      .select('*')
      .eq('template_id', id)
      .is('deleted_at', null)
      .order('position', { ascending: true }),
  ]);
  const row = unwrapMaybe(template);
  if (!row) return null;
  return { template: row, exercises: unwrap(exercises).sort(byPosition) };
}

// Creates or changes a template and replaces its list, in one request. Repeating it with the same
// draft (same ids) changes nothing.
export async function saveTemplate(_ctx: DataContext, draft: TemplateDraft): Promise<void> {
  throwIfError(await supabase.rpc('save_workout_template', { p_template: toSavePayload(draft) }));
}

// Marks the template deleted. Its exercise rows stay; nothing reads them without the template.
export async function deleteTemplate(ctx: DataContext, id: string): Promise<void> {
  throwIfError(
    await supabase
      .from('workout_templates')
      .update({ deleted_at: ctx.now().toISOString() })
      .eq('id', id)
      .eq('user_id', ctx.userId)
      .is('deleted_at', null),
  );
}
