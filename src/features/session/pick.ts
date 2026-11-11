// The exercise library's multiple choice (`/exercises?pick=…`) adds to:
// - a saved workout (template) being edited: the template id;
// - the gym session in progress: GYM_SESSION_PICK;
// - a saved gym workout being edited: editPick(activity id).
export const GYM_SESSION_PICK = 'gym-session';

const EDIT_PREFIX = 'gym-edit:';

export function editPick(activityId: string): string {
  return `${EDIT_PREFIX}${activityId}`;
}

// The activity id of an edit pick, or null for any other pick.
export function editedActivity(pick: string): string | null {
  return pick.startsWith(EDIT_PREFIX) ? pick.slice(EDIT_PREFIX.length) : null;
}
