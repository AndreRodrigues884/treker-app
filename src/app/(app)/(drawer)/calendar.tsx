import { CalendarDays } from 'lucide-react-native';

import { EmptyState, Screen } from '@/components';
import { StartWorkoutButton } from '@/features/navigation/start-workout-button';
import { useI18n } from '@/lib/i18n';

// Gym and swim history together. Empty until workouts can be logged. The title is in the header.
export default function CalendarScreen() {
  const { t } = useI18n();
  return (
    <Screen scroll belowHeader floating={<StartWorkoutButton />}>
      <EmptyState
        icon={CalendarDays}
        tone="swim"
        title={t.calendar.emptyTitle}
        body={t.calendar.emptyBody}
      />
    </Screen>
  );
}
