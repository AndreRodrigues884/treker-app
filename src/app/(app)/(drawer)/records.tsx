import { Trophy } from 'lucide-react-native';

import { EmptyState, Screen } from '@/components';
import { StartWorkoutButton } from '@/features/navigation/start-workout-button';
import { useI18n } from '@/lib/i18n';

// Personal records (computed in Postgres). Empty until workouts can be logged. The title is in
// the header.
export default function RecordsScreen() {
  const { t } = useI18n();
  return (
    <Screen scroll belowHeader floating={<StartWorkoutButton />}>
      <EmptyState
        icon={Trophy}
        tone="record"
        title={t.records.emptyTitle}
        body={t.records.emptyBody}
      />
    </Screen>
  );
}
