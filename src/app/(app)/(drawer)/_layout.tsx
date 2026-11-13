import { Drawer } from 'expo-router/drawer';
import {
  CalendarDays,
  ChartLine,
  ClipboardList,
  House,
  Trophy,
  User,
  type LucideIcon,
} from 'lucide-react-native';

import { Icon } from '@/components';
import { DrawerContent } from '@/features/navigation/drawer-content';
import { MenuButton } from '@/features/navigation/menu-button';
import { useI18n } from '@/lib/i18n';
import { accentTints, colors, fontFamilies } from '@/theme';

function drawerIcon(icon: LucideIcon) {
  return function DrawerIcon({ focused }: { focused: boolean }) {
    return <Icon icon={icon} color={focused ? 'gym' : 'textSoft'} />;
  };
}

// The main screens, in a side menu that opens from the header button or by swiping from the left
// edge. The list of screens is always the same; what the profile changes is their content.
export default function DrawerLayout() {
  const { t } = useI18n();

  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={({ navigation }) => ({
        headerLeft: () => <MenuButton onPress={() => navigation.toggleDrawer()} />,
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fontFamilies.medium },
        drawerStyle: { backgroundColor: colors.surface },
        drawerActiveTintColor: colors.gym,
        drawerActiveBackgroundColor: colors[accentTints.gym],
        drawerInactiveTintColor: colors.textSoft,
        drawerLabelStyle: { fontFamily: fontFamilies.medium },
        sceneStyle: { backgroundColor: colors.bg },
        swipeEnabled: true,
      })}
    >
      <Drawer.Screen name="index" options={{ title: t.nav.today, drawerIcon: drawerIcon(House) }} />
      <Drawer.Screen
        name="workouts"
        options={{ title: t.nav.workouts, drawerIcon: drawerIcon(ClipboardList) }}
      />
      <Drawer.Screen
        name="calendar"
        options={{ title: t.nav.calendar, drawerIcon: drawerIcon(CalendarDays) }}
      />
      <Drawer.Screen
        name="records"
        options={{ title: t.nav.records, drawerIcon: drawerIcon(Trophy) }}
      />
      <Drawer.Screen
        name="stats"
        options={{ title: t.nav.stats, drawerIcon: drawerIcon(ChartLine) }}
      />
      <Drawer.Screen
        name="profile"
        options={{ title: t.nav.profile, drawerIcon: drawerIcon(User) }}
      />
    </Drawer>
  );
}
