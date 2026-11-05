// Intro illustrations built from the app's own components, so they show what the app looks like.
// They are decorative: the page title says the same, so screen readers skip them.
import {
  ArrowUp,
  Download,
  Dumbbell,
  Lock,
  UserX,
  Waves,
  type LucideIcon,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Card, Divider, Icon, PrBadge } from '@/components';
import { formatSwimTime, formatWeight } from '@/core/format';
import { useI18n } from '@/lib/i18n';
import { colors, radii, spacing } from '@/theme';

function Decorative({ children }: { children: ReactNode }) {
  return (
    <View
      style={styles.illustration}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {children}
    </View>
  );
}

function SetLine({ weightKg, reps }: { weightKg: number; reps: number }) {
  const { language } = useI18n();
  return (
    <AppText variant="numeric">
      {formatWeight(weightKg, 'kg', language)} × {reps}
    </AppText>
  );
}

export function OneLogIllustration() {
  const { t, language } = useI18n();
  return (
    <Decorative>
      <Card>
        <View style={styles.row}>
          <Icon icon={Dumbbell} color="gym" />
          <AppText variant="heading" style={styles.flex}>
            {t.intro.demo.benchPress}
          </AppText>
          <SetLine weightKg={100} reps={5} />
        </View>
      </Card>
      <Card>
        <View style={styles.row}>
          <Icon icon={Waves} color="swim" />
          <AppText variant="heading" style={styles.flex}>
            {t.intro.demo.freestyle}
          </AppText>
          <AppText variant="numeric">{formatSwimTime(6245, language)}</AppText>
        </View>
        <Divider />
        <View style={styles.row}>
          {[2980, 3265].map((split) => (
            <Badge key={split} tone="swim" label={formatSwimTime(split, language)} />
          ))}
        </View>
      </Card>
    </Decorative>
  );
}

export function LastTimeIllustration() {
  const { t } = useI18n();
  return (
    <Decorative>
      <Card>
        <View style={styles.row}>
          <Icon icon={Dumbbell} color="gym" />
          <AppText variant="heading">{t.intro.demo.benchPress}</AppText>
        </View>
        <View style={styles.row}>
          <AppText variant="caption" color="muted" style={styles.flex}>
            {t.intro.demo.lastTime}
          </AppText>
          <SetLine weightKg={100} reps={5} />
        </View>
        <Divider />
        <View style={[styles.row, styles.highlight]}>
          <AppText variant="caption" color="positive" style={styles.flex}>
            {t.intro.demo.today}
          </AppText>
          <Icon icon={ArrowUp} size="sm" color="positive" />
          <SetLine weightKg={102.5} reps={5} />
        </View>
      </Card>
    </Decorative>
  );
}

// 100 free times (centiseconds) per pool; the bars never share a scale across pools.
const CHART = [
  { pool: 'shortCourse', length: '25 m', times: [6420, 6310, 6245] },
  { pool: 'longCourse', length: '50 m', times: [6590, 6480] },
] as const;
const BAR_MIN_HEIGHT = spacing[6];
const BAR_RANGE = spacing[10];

export function RecordsIllustration() {
  const { t, language } = useI18n();
  return (
    <Decorative>
      <View style={styles.chartRow}>
        {CHART.map(({ pool, length, times }) => {
          const best = Math.min(...times);
          const worst = Math.max(...times);
          return (
            <Card key={pool} style={styles.flex}>
              <AppText variant="caption" color="muted">
                {t.intro.demo[pool]} · {length}
              </AppText>
              <View style={styles.bars}>
                {times.map((time) => (
                  <View
                    key={time}
                    style={[
                      styles.bar,
                      {
                        // Faster times give taller bars.
                        height: BAR_MIN_HEIGHT + ((worst - time) / (worst - best)) * BAR_RANGE,
                        backgroundColor: time === best ? colors.record : colors.swimTint,
                      },
                    ]}
                  />
                ))}
              </View>
              <AppText variant="numeric">{formatSwimTime(best, language)}</AppText>
              <PrBadge />
            </Card>
          );
        })}
      </View>
    </Decorative>
  );
}

function FeatureRow({ icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <View style={styles.row}>
      <Icon icon={icon} color="positive" />
      <AppText style={styles.flex}>{label}</AppText>
    </View>
  );
}

export function PrivacyIllustration() {
  const { t } = useI18n();
  return (
    <Decorative>
      <Card>
        <FeatureRow icon={Lock} label={t.intro.demo.privateByDefault} />
        <Divider />
        <FeatureRow icon={UserX} label={t.intro.demo.deleteAnytime} />
        <Divider />
        <FeatureRow icon={Download} label={t.intro.demo.exportAnytime} />
      </Card>
    </Decorative>
  );
}

const styles = StyleSheet.create({
  illustration: {
    gap: spacing[3],
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  flex: {
    flex: 1,
  },
  highlight: {
    backgroundColor: colors.positiveTint,
    borderRadius: radii.sm,
    padding: spacing[2],
  },
  chartRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[2],
    height: BAR_MIN_HEIGHT + BAR_RANGE,
  },
  bar: {
    width: spacing[4],
    borderRadius: radii.sm,
  },
});
