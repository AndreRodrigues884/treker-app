import { GripVertical, Pencil, Trash2, Trophy } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Sortable from 'react-native-sortables';

import { AppText, ConfirmDialog, Icon, type LucideIcon } from '@/components';
import { interpolate } from '@/core/i18n';
import {
  doneCount,
  lastTimeAt,
  planOf,
  type GymSession,
  type SessionExercise,
  type SessionSet,
} from '@/core/session';
import { useI18n } from '@/lib/i18n';
import { accentTints, colors, opacity, radii, sizes, spacing, type AccentTone } from '@/theme';

import { difficultyLabel, difficultyTone } from './difficulty';
import { PlanPanel } from './plan-panel';
import type { useSessionActions } from './queries';
import { SetPanel } from './set-panel';

export type SessionExerciseCardProps = {
  session: GymSession;
  exercise: SessionExercise;
  index: number;
  name: string;
  actions: ReturnType<typeof useSessionActions>;
};

/**
 * One exercise of the session: its name and plan ("5 × 5 reps"), how many sets are done, the
 * pencil (sets and target) and the bin, a drag handle, and one square per set. Tapping a set opens
 * it to fill in; a done set is coloured by how hard it felt (easy green, medium amber, hard red).
 */
export function SessionExerciseCard({
  session,
  exercise,
  index,
  name,
  actions,
}: SessionExerciseCardProps) {
  const { t } = useI18n();
  const [openSetId, setOpenSetId] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const done = doneCount(exercise);
  const total = exercise.sets.length;
  const plan = planOf(exercise);
  const planText =
    exercise.unit === 'reps'
      ? interpolate(t.session.planReps, { sets: total, reps: plan.reps ?? 0 })
      : interpolate(t.session.planSeconds, { sets: total, seconds: plan.seconds ?? 0 });
  const openIndex = exercise.sets.findIndex((set) => set.id === openSetId);
  const openSet = openIndex >= 0 ? exercise.sets[openIndex] : undefined;
  const isFirst = index === 0;
  const isLast = index === session.exercises.length - 1;

  const remove = () => {
    if (done > 0) setConfirmRemove(true);
    else void actions.removeExercise(exercise.key);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.title}>
          <AppText variant="heading" accessibilityRole="header" numberOfLines={2}>
            {name}
          </AppText>
          <AppText color="muted">{planText}</AppText>
        </View>
        <AppText
          variant="numeric"
          color="muted"
          accessibilityLabel={interpolate(t.session.setsDoneLabel, { done, total })}
        >
          {interpolate(t.session.setsDone, { done, total })}
        </AppText>
        <IconButton
          icon={Pencil}
          label={interpolate(t.session.editPlan, { name })}
          onPress={() => {
            setOpenSetId(null);
            setEditingPlan((current) => !current);
          }}
        />
        <IconButton
          icon={Trash2}
          color="danger"
          label={interpolate(t.session.removeExercise, { name })}
          onPress={remove}
        />
      </View>

      <View style={styles.handleRow}>
        <Sortable.Handle>
          <View
            style={styles.handle}
            accessible
            accessibilityLabel={interpolate(t.session.drag, { name })}
            accessibilityActions={[
              ...(isFirst ? [] : [{ name: 'moveUp', label: t.session.moveUp }]),
              ...(isLast ? [] : [{ name: 'moveDown', label: t.session.moveDown }]),
            ]}
            onAccessibilityAction={(event) =>
              void actions.moveExercise(
                exercise.key,
                event.nativeEvent.actionName === 'moveUp' ? -1 : 1,
              )
            }
          >
            <Icon icon={GripVertical} color="dim" />
          </View>
        </Sortable.Handle>
      </View>

      <View style={styles.sets}>
        {exercise.sets.map((set, setIndex) => (
          <SetSquare
            key={set.id}
            set={set}
            number={setIndex + 1}
            open={set.id === openSetId}
            onPress={() => {
              setEditingPlan(false);
              setOpenSetId(set.id === openSetId ? null : set.id);
            }}
          />
        ))}
      </View>

      {openSet && (
        <SetPanel
          // A fresh panel for each set, with that set's values.
          key={openSet.id}
          exercise={exercise}
          set={openSet}
          index={openIndex}
          unit={session.weightUnit}
          last={lastTimeAt(exercise.last, openIndex)}
          onCancel={() => setOpenSetId(null)}
          onSave={(values) => {
            setOpenSetId(null);
            void actions.saveSet(exercise.key, openSet.id, values);
          }}
        />
      )}

      {editingPlan && (
        <PlanPanel
          exercise={exercise}
          onCancel={() => setEditingPlan(false)}
          onSave={(next) => {
            setEditingPlan(false);
            void actions.setPlan(exercise.key, next);
          }}
        />
      )}

      <ConfirmDialog
        visible={confirmRemove}
        tone="danger"
        title={interpolate(t.session.removeTitle, { name })}
        body={t.session.removeBody}
        confirmLabel={t.session.removeConfirm}
        cancelLabel={t.common.cancel}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => {
          setConfirmRemove(false);
          void actions.removeExercise(exercise.key);
        }}
      />
    </View>
  );
}

// One set as a square with its number: plain until done, then coloured by how hard it felt
// (or in the app's accent when no difficulty was chosen); outlined while open.
function SetSquare({
  set,
  number,
  open,
  onPress,
}: {
  set: SessionSet;
  number: number;
  open: boolean;
  onPress: () => void;
}) {
  const { t } = useI18n();
  const tone: AccentTone | null = set.done
    ? set.difficulty
      ? difficultyTone[set.difficulty]
      : 'gym'
    : null;
  const label = [
    interpolate(set.done ? t.session.setDone : t.session.setNotDone, { number }),
    set.done && set.difficulty ? difficultyLabel(t, set.difficulty) : null,
    set.pr ? t.records.prLabel : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded: open }}
      style={({ pressed }) => [
        styles.square,
        tone && { borderColor: colors[tone], backgroundColor: colors[accentTints[tone]] },
        open && styles.squareOpen,
        pressed && styles.pressed,
      ]}
    >
      <AppText variant="numeric" color={tone ?? 'textSoft'}>
        {number}
      </AppText>
      {set.pr && <Icon icon={Trophy} size="sm" color="record" />}
    </Pressable>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  color = 'textSoft',
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  color?: 'textSoft' | 'danger';
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      <Icon icon={icon} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: sizes.border,
    borderRadius: radii.lg,
    padding: spacing[4],
    gap: spacing[3],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[1],
  },
  title: {
    flex: 1,
    gap: spacing[1],
  },
  handleRow: {
    alignItems: 'flex-end',
    marginTop: -spacing[3],
  },
  handle: {
    width: sizes.minTouch,
    height: sizes.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  square: {
    minWidth: sizes.minTouch + spacing[1],
    height: sizes.minTouch + spacing[1],
    paddingHorizontal: spacing[2],
    flexDirection: 'row',
    gap: spacing[1],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: sizes.border,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  squareOpen: {
    borderColor: colors.gym,
    borderWidth: sizes.border * 2,
  },
  iconButton: {
    width: sizes.minTouch,
    height: sizes.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  pressed: {
    opacity: opacity.pressed,
  },
});
