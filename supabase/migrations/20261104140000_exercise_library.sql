-- Shared exercise library (owner_id null), shipped as a migration so it exists in every
-- environment. Names in English and European Portuguese. Ids are derived from the slug (UUID v5),
-- so they are the same everywhere and stay stable for offline references. Re-running updates the
-- names and attributes in place.

create extension if not exists "uuid-ossp" with schema extensions;

insert into public.exercises (
  id, slug, name_en, name_pt, muscle_group, equipment, tracks_load, unit, adds_bodyweight
)
select
  extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'https://treker.app/exercises/' || e.slug),
  e.slug, e.name_en, e.name_pt,
  e.muscle_group::public.muscle_group, e.equipment::public.equipment,
  e.tracks_load, e.unit::public.exercise_unit, e.adds_bodyweight
from (
  values
    -- Chest
    ('barbell-bench-press', 'Barbell Bench Press', 'Supino plano com barra', 'chest', 'barbell', true, 'reps', false),
    ('incline-barbell-bench-press', 'Incline Barbell Bench Press', 'Supino inclinado com barra', 'chest', 'barbell', true, 'reps', false),
    ('decline-barbell-bench-press', 'Decline Barbell Bench Press', 'Supino declinado com barra', 'chest', 'barbell', true, 'reps', false),
    ('dumbbell-bench-press', 'Dumbbell Bench Press', 'Supino plano com halteres', 'chest', 'dumbbell', true, 'reps', false),
    ('incline-dumbbell-bench-press', 'Incline Dumbbell Bench Press', 'Supino inclinado com halteres', 'chest', 'dumbbell', true, 'reps', false),
    ('dumbbell-fly', 'Dumbbell Fly', 'Aberturas com halteres', 'chest', 'dumbbell', true, 'reps', false),
    ('cable-crossover', 'Cable Crossover', 'Cruzamento na polia', 'chest', 'cable', true, 'reps', false),
    ('machine-chest-press', 'Machine Chest Press', 'Supino na máquina', 'chest', 'machine', true, 'reps', false),
    ('pec-deck', 'Pec Deck', 'Peck deck', 'chest', 'machine', true, 'reps', false),
    ('push-up', 'Push-up', 'Flexões', 'chest', 'bodyweight', false, 'reps', false),
    ('chest-dip', 'Chest Dip', 'Dips para peito', 'chest', 'bodyweight', true, 'reps', true),
    -- Back
    ('deadlift', 'Deadlift', 'Peso morto', 'back', 'barbell', true, 'reps', false),
    ('barbell-row', 'Barbell Row', 'Remada com barra', 'back', 'barbell', true, 'reps', false),
    ('one-arm-dumbbell-row', 'One-Arm Dumbbell Row', 'Remada unilateral com halter', 'back', 'dumbbell', true, 'reps', false),
    ('t-bar-row', 'T-Bar Row', 'Remada em T', 'back', 'barbell', true, 'reps', false),
    ('seated-cable-row', 'Seated Cable Row', 'Remada sentada na polia', 'back', 'cable', true, 'reps', false),
    ('machine-row', 'Machine Row', 'Remada na máquina', 'back', 'machine', true, 'reps', false),
    ('lat-pulldown', 'Lat Pulldown', 'Puxada à frente', 'back', 'cable', true, 'reps', false),
    ('straight-arm-pulldown', 'Straight-Arm Pulldown', 'Pullover na polia', 'back', 'cable', true, 'reps', false),
    ('pull-up', 'Pull-up', 'Elevações na barra', 'back', 'bodyweight', true, 'reps', true),
    ('chin-up', 'Chin-up', 'Elevações na barra em supinação', 'back', 'bodyweight', true, 'reps', true),
    ('back-extension', 'Back Extension', 'Extensão lombar', 'back', 'bodyweight', true, 'reps', false),
    ('dumbbell-shrug', 'Dumbbell Shrug', 'Encolhimentos com halteres', 'back', 'dumbbell', true, 'reps', false),
    -- Shoulders
    ('overhead-press', 'Overhead Press', 'Desenvolvimento militar com barra', 'shoulders', 'barbell', true, 'reps', false),
    ('dumbbell-shoulder-press', 'Dumbbell Shoulder Press', 'Desenvolvimento com halteres', 'shoulders', 'dumbbell', true, 'reps', false),
    ('machine-shoulder-press', 'Machine Shoulder Press', 'Desenvolvimento na máquina', 'shoulders', 'machine', true, 'reps', false),
    ('arnold-press', 'Arnold Press', 'Press Arnold', 'shoulders', 'dumbbell', true, 'reps', false),
    ('lateral-raise', 'Lateral Raise', 'Elevação lateral com halteres', 'shoulders', 'dumbbell', true, 'reps', false),
    ('cable-lateral-raise', 'Cable Lateral Raise', 'Elevação lateral na polia', 'shoulders', 'cable', true, 'reps', false),
    ('front-raise', 'Front Raise', 'Elevação frontal com halteres', 'shoulders', 'dumbbell', true, 'reps', false),
    ('rear-delt-fly', 'Rear Delt Fly', 'Aberturas invertidas', 'shoulders', 'dumbbell', true, 'reps', false),
    ('face-pull', 'Face Pull', 'Face pull na polia', 'shoulders', 'cable', true, 'reps', false),
    ('upright-row', 'Upright Row', 'Remada alta', 'shoulders', 'barbell', true, 'reps', false),
    -- Biceps
    ('barbell-curl', 'Barbell Curl', 'Curl com barra', 'biceps', 'barbell', true, 'reps', false),
    ('ez-bar-curl', 'EZ-Bar Curl', 'Curl com barra EZ', 'biceps', 'ez_bar', true, 'reps', false),
    ('dumbbell-curl', 'Dumbbell Curl', 'Curl com halteres', 'biceps', 'dumbbell', true, 'reps', false),
    ('hammer-curl', 'Hammer Curl', 'Curl martelo', 'biceps', 'dumbbell', true, 'reps', false),
    ('preacher-curl', 'Preacher Curl', 'Curl no banco Scott', 'biceps', 'ez_bar', true, 'reps', false),
    ('cable-curl', 'Cable Curl', 'Curl na polia', 'biceps', 'cable', true, 'reps', false),
    -- Triceps
    ('triceps-pushdown', 'Triceps Pushdown', 'Extensão de tríceps na polia', 'triceps', 'cable', true, 'reps', false),
    ('overhead-triceps-extension', 'Overhead Triceps Extension', 'Extensão de tríceps acima da cabeça', 'triceps', 'dumbbell', true, 'reps', false),
    ('skull-crusher', 'Skull Crusher', 'Extensão de tríceps deitado (testa)', 'triceps', 'ez_bar', true, 'reps', false),
    ('close-grip-bench-press', 'Close-Grip Bench Press', 'Supino com pega fechada', 'triceps', 'barbell', true, 'reps', false),
    ('triceps-dip', 'Triceps Dip', 'Dips para tríceps', 'triceps', 'bodyweight', true, 'reps', true),
    -- Forearms
    ('wrist-curl', 'Wrist Curl', 'Flexão de punhos', 'forearms', 'dumbbell', true, 'reps', false),
    -- Legs
    ('back-squat', 'Back Squat', 'Agachamento com barra', 'quads', 'barbell', true, 'reps', false),
    ('front-squat', 'Front Squat', 'Agachamento frontal', 'quads', 'barbell', true, 'reps', false),
    ('goblet-squat', 'Goblet Squat', 'Agachamento goblet', 'quads', 'dumbbell', true, 'reps', false),
    ('leg-press', 'Leg Press', 'Prensa de pernas', 'quads', 'machine', true, 'reps', false),
    ('hack-squat', 'Hack Squat', 'Agachamento hack', 'quads', 'machine', true, 'reps', false),
    ('leg-extension', 'Leg Extension', 'Cadeira extensora', 'quads', 'machine', true, 'reps', false),
    ('bulgarian-split-squat', 'Bulgarian Split Squat', 'Agachamento búlgaro', 'quads', 'dumbbell', true, 'reps', false),
    ('walking-lunge', 'Walking Lunge', 'Afundos a andar', 'quads', 'dumbbell', true, 'reps', false),
    ('romanian-deadlift', 'Romanian Deadlift', 'Peso morto romeno', 'hamstrings', 'barbell', true, 'reps', false),
    ('lying-leg-curl', 'Lying Leg Curl', 'Mesa flexora', 'hamstrings', 'machine', true, 'reps', false),
    ('seated-leg-curl', 'Seated Leg Curl', 'Cadeira flexora', 'hamstrings', 'machine', true, 'reps', false),
    ('hip-thrust', 'Barbell Hip Thrust', 'Hip thrust com barra', 'glutes', 'barbell', true, 'reps', false),
    ('cable-kickback', 'Cable Kickback', 'Coice na polia', 'glutes', 'cable', true, 'reps', false),
    ('standing-calf-raise', 'Standing Calf Raise', 'Elevação de gémeos em pé', 'calves', 'machine', true, 'reps', false),
    ('seated-calf-raise', 'Seated Calf Raise', 'Elevação de gémeos sentado', 'calves', 'machine', true, 'reps', false),
    -- Core
    ('plank', 'Plank', 'Prancha', 'core', 'bodyweight', false, 'seconds', false),
    ('side-plank', 'Side Plank', 'Prancha lateral', 'core', 'bodyweight', false, 'seconds', false),
    ('hanging-leg-raise', 'Hanging Leg Raise', 'Elevação de pernas suspenso', 'core', 'bodyweight', false, 'reps', false),
    ('cable-crunch', 'Cable Crunch', 'Abdominal na polia', 'core', 'cable', true, 'reps', false),
    ('ab-wheel-rollout', 'Ab Wheel Rollout', 'Roda abdominal', 'core', 'other', false, 'reps', false),
    -- Full body
    ('kettlebell-swing', 'Kettlebell Swing', 'Swing com kettlebell', 'full_body', 'kettlebell', true, 'reps', false),
    ('power-clean', 'Power Clean', 'Power clean', 'full_body', 'barbell', true, 'reps', false),
    ('farmers-walk', 'Farmer''s Walk', 'Marcha do agricultor', 'full_body', 'dumbbell', true, 'seconds', false)
) as e (slug, name_en, name_pt, muscle_group, equipment, tracks_load, unit, adds_bodyweight)
on conflict (slug) do update set
  name_en = excluded.name_en,
  name_pt = excluded.name_pt,
  muscle_group = excluded.muscle_group,
  equipment = excluded.equipment,
  tracks_load = excluded.tracks_load,
  unit = excluded.unit,
  adds_bodyweight = excluded.adds_bodyweight;
