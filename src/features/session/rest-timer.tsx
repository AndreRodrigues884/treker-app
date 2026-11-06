import { Minus, Plus, SkipForward } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { AppText, Button, Icon, type LucideIcon } from '@/components';
import { formatClock } from '@/core/format';
import { interpolate } from '@/core/i18n';
import { useI18n } from '@/lib/i18n';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { colors, opacity, radii, sizes, spacing, typography } from '@/theme';

export type RestTimerProps = {
  remainingS: number;
  // The rest's full length, for the ring.
  durationS: number;
  onLess: () => void;
  onMore: () => void;
  onSkip: () => void;
};

const BALL = sizes.minTouch * 4;
const RING = spacing[2];
const RADIUS = (BALL - RING) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GRABBER_WIDTH = spacing[10];

// How much of the screen the sheet covers: the session leaves this room at the bottom of its list
// while resting, so the last sets stay reachable.
export const REST_SHEET_HEIGHT =
  spacing[3] + spacing[1] + spacing[4] + BALL + spacing[4] + sizes.control + spacing[6];

/**
 * The rest timer: a sheet that slides up from the bottom of the screen with the countdown in a
 * ball (its ring empties as the rest runs out), − and + (15 s) on its sides, and "Skip" centred
 * below. It slides back down when the rest is over or skipped. Without animations when the
 * system asks for reduced motion.
 */
export function RestTimer({ remainingS, durationS, onLess, onMore, onSkip }: RestTimerProps) {
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const time = formatClock(remainingS);
  const fraction = durationS > 0 ? Math.min(1, Math.max(0, remainingS / durationS)) : 0;

  return (
    <Animated.View
      style={styles.sheet}
      entering={reducedMotion ? undefined : SlideInDown.duration(250)}
      exiting={reducedMotion ? undefined : SlideOutDown.duration(200)}
    >
      <View style={styles.grabber} />
      <View style={styles.row}>
        <SideButton icon={Minus} label={t.session.restLess} onPress={onLess} />
        <View
          style={styles.ball}
          accessible
          accessibilityRole="timer"
          accessibilityLabel={interpolate(t.session.restLeft, { time })}
        >
          <Svg width={BALL} height={BALL} style={StyleSheet.absoluteFill}>
            <Circle
              cx={BALL / 2}
              cy={BALL / 2}
              r={RADIUS}
              stroke={colors.line}
              strokeWidth={RING}
              fill={colors.card}
            />
            <Circle
              cx={BALL / 2}
              cy={BALL / 2}
              r={RADIUS}
              stroke={colors.gym}
              strokeWidth={RING}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
              // Starts at the top and runs clockwise.
              transform={`rotate(-90 ${BALL / 2} ${BALL / 2})`}
            />
          </Svg>
          <AppText variant="caption" color="muted">
            {t.session.rest}
          </AppText>
          <AppText style={styles.time} maxFontSizeMultiplier={1.2}>
            {time}
          </AppText>
        </View>
        <SideButton icon={Plus} label={t.session.restMore} onPress={onMore} />
      </View>
      <Button label={t.session.skipRest} icon={SkipForward} variant="secondary" onPress={onSkip} />
    </Animated.View>
  );
}

function SideButton({
  icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.side, pressed && styles.pressed]}
    >
      <Icon icon={icon} size="lg" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[6],
    paddingHorizontal: spacing[4],
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: sizes.border,
    borderBottomWidth: 0,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    // Lifts it above the cards behind.
    elevation: spacing[4],
    shadowColor: colors.bg,
    shadowOpacity: opacity.disabled,
    shadowRadius: spacing[4],
    shadowOffset: { width: 0, height: -spacing[1] },
  },
  grabber: {
    width: GRABBER_WIDTH,
    height: spacing[1],
    borderRadius: radii.pill,
    backgroundColor: colors.lineStrong,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  ball: {
    width: BALL,
    height: BALL,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: {
    ...typography.display,
    fontFamily: typography.numeric.fontFamily,
    fontVariant: typography.numeric.fontVariant,
  },
  side: {
    width: sizes.fab,
    height: sizes.fab,
    borderRadius: radii.pill,
    borderWidth: sizes.border,
    borderColor: colors.lineStrong,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: opacity.pressed,
  },
});
