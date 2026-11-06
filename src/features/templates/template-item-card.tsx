import { ArrowDown, ArrowUp, GripVertical, X } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Sortable from 'react-native-sortables';

import { AppText, Icon, Stepper, type LucideIcon } from '@/components';
import { interpolate } from '@/core/i18n';
import { TARGET_REPS, TARGET_SECONDS, TARGET_SETS, type TemplateItem } from '@/core/templates';
import { useI18n } from '@/lib/i18n';
import { colors, opacity, radii, sizes, spacing } from '@/theme';

export type TemplateItemCardProps = {
  item: TemplateItem;
  name: string;
  // The exercise's equipment, under its name (e.g. "Bodyweight").
  equipment: string;
  index: number;
  total: number;
  onChange: (
    changes: Partial<Pick<TemplateItem, 'targetSets' | 'targetReps' | 'targetSeconds'>>,
  ) => void;
  onMove: (offset: -1 | 1) => void;
  onRemove: () => void;
};

// One exercise in the template editor: a drag handle, move up/down buttons (for screen readers
// and anyone who prefers them), remove, and the target sets and reps (or seconds).
export function TemplateItemCard({
  item,
  name,
  equipment,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: TemplateItemCardProps) {
  const { t } = useI18n();
  const editor = t.templateEditor;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Sortable.Handle>
          <View
            style={styles.handle}
            accessible
            accessibilityLabel={interpolate(editor.drag, { name })}
            accessibilityHint={editor.reorderHint}
          >
            <Icon icon={GripVertical} color="dim" />
          </View>
        </Sortable.Handle>
        <View style={styles.title}>
          <AppText variant="heading" numberOfLines={2} accessibilityRole="header">
            {name}
          </AppText>
          {equipment !== '' && (
            <AppText variant="caption" color="muted">
              {equipment}
            </AppText>
          )}
        </View>
        <View style={styles.buttons}>
          <IconButton
            icon={ArrowUp}
            label={interpolate(editor.moveUp, { name })}
            disabled={index === 0}
            onPress={() => onMove(-1)}
          />
          <IconButton
            icon={ArrowDown}
            label={interpolate(editor.moveDown, { name })}
            disabled={index === total - 1}
            onPress={() => onMove(1)}
          />
          <IconButton
            icon={X}
            color="danger"
            label={interpolate(editor.remove, { name })}
            onPress={onRemove}
          />
        </View>
      </View>

      <View style={styles.targets}>
        <View style={styles.target}>
          <Stepper
            size="compact"
            value={item.targetSets}
            min={TARGET_SETS.min}
            max={TARGET_SETS.max}
            onChange={(targetSets) => onChange({ targetSets })}
            label={`${name}: ${editor.sets}`}
            valueText={interpolate(editor.setsValue, { count: item.targetSets })}
            decreaseLabel={editor.fewerSets}
            increaseLabel={editor.moreSets}
          />
        </View>
        {item.unit === 'reps' ? (
          <View style={styles.target}>
            <Stepper
              size="compact"
              value={item.targetReps}
              min={TARGET_REPS.min}
              max={TARGET_REPS.max}
              onChange={(targetReps) => onChange({ targetReps })}
              label={`${name}: ${editor.reps}`}
              valueText={interpolate(editor.repsValue, { count: item.targetReps })}
              decreaseLabel={editor.fewerReps}
              increaseLabel={editor.moreReps}
            />
          </View>
        ) : (
          <View style={styles.target}>
            <Stepper
              size="compact"
              step={TARGET_SECONDS.step}
              value={item.targetSeconds}
              min={TARGET_SECONDS.min}
              max={TARGET_SECONDS.max}
              onChange={(targetSeconds) => onChange({ targetSeconds })}
              label={`${name}: ${editor.seconds}`}
              valueText={interpolate(editor.secondsValue, { count: item.targetSeconds })}
              decreaseLabel={editor.fewerSeconds}
              increaseLabel={editor.moreSeconds}
            />
          </View>
        )}
      </View>
    </View>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
  color = 'textSoft',
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  color?: 'textSoft' | 'danger';
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.iconButton,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Icon icon={icon} size="md" color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: sizes.border,
    borderRadius: radii.lg,
    padding: spacing[3],
    gap: spacing[3],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  handle: {
    width: sizes.minTouch,
    height: sizes.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    gap: spacing[1],
  },
  // Touching 44 pt targets, so the icons sit closer together.
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  targets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[4],
  },
  target: {
    flexGrow: 1,
    flexBasis: sizes.minTouch * 4,
    gap: spacing[1],
  },
  iconButton: {
    width: sizes.minTouch,
    height: sizes.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  disabled: {
    opacity: opacity.disabled,
  },
  pressed: {
    opacity: opacity.pressed,
  },
});
