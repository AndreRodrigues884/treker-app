import Constants from 'expo-constants';
import {
  DrawerContentScrollView,
  DrawerItemList,
  type DrawerContentComponentProps,
} from 'expo-router/drawer';
import { StyleSheet, View } from 'react-native';

import { AppText, Divider, Logo, ProgressBar } from '@/components';
import { interpolate } from '@/core/i18n';
import { useWorkoutsThisWeek } from '@/features/activities/queries';
import { useAuth } from '@/features/auth/auth-provider';
import { useI18n } from '@/lib/i18n';
import { sizes, spacing } from '@/theme';

// The side menu: logo, the athlete's name and weekly goal on top, the screens, and the app
// version at the bottom.
export function DrawerContent(props: DrawerContentComponentProps) {
  const { t } = useI18n();
  const { profile } = useAuth();
  const done = useWorkoutsThisWeek().data ?? 0;
  const target = profile?.weekly_target ?? null;
  const goal = target !== null ? interpolate(t.today.weeklyProgress, { done, target }) : null;
  const version = Constants.expoConfig?.version ?? '?';

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Brand />
        {profile?.display_name ? <AppText variant="heading">{profile.display_name}</AppText> : null}
        {goal !== null && target !== null && (
          <View style={styles.goal}>
            <AppText variant="caption" color="muted">
              {goal}
            </AppText>
            <ProgressBar value={done / target} accessibilityLabel={goal} />
          </View>
        )}
      </View>
      <Divider />

      <View style={styles.items}>
        <DrawerItemList {...props} />
      </View>

      <AppText variant="caption" color="dim" style={styles.version}>
        {interpolate(t.profile.version, { version })}
      </AppText>
    </DrawerContentScrollView>
  );
}

// The logo and the app name, read once as "Treker".
function Brand() {
  return (
    <View style={styles.logo} accessible accessibilityRole="header" accessibilityLabel="Treker">
      <Logo size={sizes.minTouch} />
      <AppText variant="title">Treker</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing[3],
  },
  header: {
    gap: spacing[2],
    paddingHorizontal: spacing[2],
    paddingBottom: spacing[4],
  },
  goal: {
    gap: spacing[2],
  },
  logo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  items: {
    flex: 1,
    paddingTop: spacing[3],
  },
  version: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[4],
  },
});
