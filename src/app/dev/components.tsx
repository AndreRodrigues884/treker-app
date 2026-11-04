// Dev-only catalog of the base components and their variants. Its texts are not translated.
import { Redirect, router } from 'expo-router';
import {
  ArrowLeft,
  CalendarDays,
  Dumbbell,
  Plus,
  Timer,
  Trophy,
  Waves,
  type LucideIcon,
} from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Badge,
  Button,
  Card,
  Chip,
  Divider,
  Icon,
  PrBadge,
  ProgressBar,
  Screen,
  TextField,
  type BadgeTone,
  type ButtonVariant,
} from '@/components';
import { formatDistance, formatSwimTime, formatWeight } from '@/core/format';
import { languages } from '@/core/i18n';
import { useI18n } from '@/lib/i18n';
import {
  colors,
  radii,
  sizes,
  spacing,
  typography,
  type AccentTone,
  type ColorToken,
  type TextVariant,
} from '@/theme';

const textVariants = Object.keys(typography) as TextVariant[];
const colorTokens = Object.keys(colors) as ColorToken[];
const buttonVariants: ButtonVariant[] = ['primary', 'secondary', 'ghost'];
const badgeTones: BadgeTone[] = ['neutral', 'gym', 'swim', 'record', 'positive', 'danger'];
const accentTones: AccentTone[] = ['gym', 'swim', 'record', 'positive', 'danger'];
const icons: [string, LucideIcon][] = [
  ['Dumbbell', Dumbbell],
  ['Waves', Waves],
  ['Trophy', Trophy],
  ['Timer', Timer],
  ['CalendarDays', CalendarDays],
  ['Plus', Plus],
];

export default function ComponentCatalogRoute() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }
  return <ComponentCatalog />;
}

function ComponentCatalog() {
  const { language } = useI18n();
  const [selectedChips, setSelectedChips] = useState<string[]>(['Gym']);
  const [weight, setWeight] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleChip = (label: string) =>
    setSelectedChips((current) =>
      current.includes(label) ? current.filter((item) => item !== label) : [...current, label],
    );

  const simulateLoading = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  };

  return (
    <Screen scroll>
      <View style={styles.page}>
        <Button label="Back" variant="ghost" icon={ArrowLeft} onPress={() => router.back()} />
        <AppText variant="title" accessibilityRole="header">
          Components
        </AppText>
        <AppText color="muted">Device language: {language}</AppText>

        <Section title="Typography">
          {textVariants.map((variant) => (
            <View key={variant} style={styles.row}>
              <AppText variant="caption" color="dim" style={styles.rowLabel}>
                {variant}
              </AppText>
              <AppText variant={variant} style={styles.flex}>
                {variant === 'numeric' ? '1:02.45  102.5 kg  ×8' : 'Treino A'}
              </AppText>
            </View>
          ))}
        </Section>

        <Section title="Colors">
          <View style={styles.wrap}>
            {colorTokens.map((token) => (
              <View key={token} style={styles.swatch}>
                <View style={[styles.swatchColor, { backgroundColor: colors[token] }]} />
                <AppText variant="caption" color="muted">
                  {token}
                </AppText>
              </View>
            ))}
          </View>
        </Section>

        <Section title="Icons (Lucide)">
          <View style={styles.wrap}>
            {icons.map(([name, glyph]) => (
              <View key={name} style={styles.iconItem}>
                <Icon icon={glyph} size="lg" />
                <AppText variant="caption" color="dim">
                  {name}
                </AppText>
              </View>
            ))}
          </View>
        </Section>

        <Section title="Button">
          {buttonVariants.map((variant) => (
            <View key={variant} style={styles.wrap}>
              <Button label={variant} variant={variant} onPress={simulateLoading} />
              <Button label="Icon" variant={variant} icon={Plus} onPress={() => {}} />
              <Button label="Loading" variant={variant} loading onPress={() => {}} />
              <Button label="Disabled" variant={variant} disabled onPress={() => {}} />
            </View>
          ))}
          <Button
            label="Save session (tap me)"
            loading={loading}
            fullWidth
            onPress={simulateLoading}
          />
        </Section>

        <Section title="Card">
          <Card>
            <View style={styles.cardHeader}>
              <Icon icon={Dumbbell} color="gym" />
              <AppText variant="heading" style={styles.flex}>
                Push day
              </AppText>
              <PrBadge />
            </View>
            <Divider />
            <AppText variant="numeric">{formatWeight(102.5, 'kg', language)} × 5</AppText>
          </Card>
        </Section>

        <Section title="TextField">
          <TextField label="Session name" placeholder="Treino A" />
          <TextField
            label="Weight (numeric)"
            numeric
            placeholder="0"
            value={weight}
            onChangeText={setWeight}
          />
          <TextField label="Reps" numeric defaultValue="0" error="Enter at least 1 rep." />
        </Section>

        <Section title="Chip">
          <View style={styles.wrap}>
            <Chip
              label="Gym"
              icon={Dumbbell}
              selected={selectedChips.includes('Gym')}
              onPress={() => toggleChip('Gym')}
            />
            <Chip
              label="Swim"
              tone="swim"
              icon={Waves}
              selected={selectedChips.includes('Swim')}
              onPress={() => toggleChip('Swim')}
            />
            <Chip label="Disabled" selected={false} disabled onPress={() => {}} />
          </View>
        </Section>

        <Section title="Badge">
          <View style={styles.wrap}>
            {badgeTones.map((tone) => (
              <Badge key={tone} label={tone} tone={tone} />
            ))}
          </View>
          <View style={styles.wrap}>
            {accentTones.map((tone) => (
              <Badge key={tone} label={tone} tone={tone} emphasis="solid" />
            ))}
          </View>
          <View style={styles.wrap}>
            <PrBadge />
            <Badge label="Long course" tone="swim" icon={Waves} />
          </View>
        </Section>

        <Section title="ProgressBar">
          {accentTones.map((tone, index) => (
            <ProgressBar
              key={tone}
              tone={tone}
              value={(index + 1) / accentTones.length}
              accessibilityLabel={`${tone} progress`}
            />
          ))}
        </Section>

        <Section title="Divider">
          <AppText color="muted">Above</AppText>
          <Divider />
          <AppText color="muted">Below</AppText>
        </Section>

        <Section title="Number formatting">
          {languages.map((lang) => (
            <View key={lang} style={styles.row}>
              <AppText variant="caption" color="dim" style={styles.rowLabel}>
                {lang}
              </AppText>
              <AppText variant="numeric" style={styles.flex}>
                {formatSwimTime(2761, lang)} · {formatSwimTime(6245, lang)} ·{' '}
                {formatWeight(102.5, 'kg', lang)} · {formatDistance(1500, 'm', lang)}
              </AppText>
            </View>
          ))}
        </Section>
      </View>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: spacing[4],
  },
  section: {
    gap: spacing[3],
    paddingTop: spacing[4],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing[3],
  },
  rowLabel: {
    width: spacing[16],
  },
  flex: {
    flex: 1,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing[2],
  },
  swatch: {
    width: spacing[16] + spacing[6],
    gap: spacing[1],
  },
  swatchColor: {
    height: spacing[10],
    borderRadius: radii.sm,
    borderWidth: sizes.border,
    borderColor: colors.line,
  },
  iconItem: {
    alignItems: 'center',
    gap: spacing[1],
    width: spacing[16] + spacing[6],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
});
