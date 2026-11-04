import { router } from 'expo-router';
import { useRef, useState, type ComponentType } from 'react';
import {
  FlatList,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { AppText, Button, Screen } from '@/components';
import { interpolate } from '@/core/i18n';
import {
  LastTimeIllustration,
  OfflineIllustration,
  OneLogIllustration,
  RecordsIllustration,
} from '@/features/intro/illustrations';
import { useIntro } from '@/features/intro/intro-state';
import { useI18n } from '@/lib/i18n';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { colors, radii, spacing } from '@/theme';

type PageKey = 'oneLog' | 'lastTime' | 'records' | 'offline';

const PAGES: { key: PageKey; Illustration: ComponentType }[] = [
  { key: 'oneLog', Illustration: OneLogIllustration },
  { key: 'lastTime', Illustration: LastTimeIllustration },
  { key: 'records', Illustration: RecordsIllustration },
  { key: 'offline', Illustration: OfflineIllustration },
];

const DOT_SIZE = spacing[2];

// Shown once, before the first sign-in. Sign-in is by email code, so "Get started" and "I already
// have an account" both open the email screen; only its title changes.
export default function WelcomeScreen() {
  const { t } = useI18n();
  const { markIntroSeen } = useIntro();
  const reducedMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const list = useRef<FlatList<(typeof PAGES)[number]>>(null);
  const [index, setIndex] = useState(0);

  const isLast = index === PAGES.length - 1;

  const finish = async (mode: 'signup' | 'signin') => {
    await markIntroSeen();
    router.replace({ pathname: '/sign-in', params: { mode } });
  };

  const goTo = (target: number) => {
    setIndex(target);
    list.current?.scrollToIndex({ index: target, animated: !reducedMotion });
  };

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <Screen>
      <View style={styles.top}>
        <Button label={t.intro.skip} variant="ghost" onPress={() => finish('signup')} />
      </View>

      <FlatList
        ref={list}
        data={PAGES}
        keyExtractor={(page) => page.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, itemIndex) => ({
          length: width,
          offset: width * itemIndex,
          index: itemIndex,
        })}
        // The Screen padding is undone so each page spans the full width.
        style={{ marginHorizontal: -spacing[4] }}
        renderItem={({ item }) => {
          const page = t.intro.pages[item.key];
          return (
            <View style={[styles.page, { width }]}>
              <item.Illustration />
              <View style={styles.text}>
                <AppText variant="title" align="center" accessibilityRole="header">
                  {page.title}
                </AppText>
                {'body' in page && (
                  <AppText color="muted" align="center">
                    {page.body}
                  </AppText>
                )}
              </View>
            </View>
          );
        }}
      />

      <View style={styles.bottom}>
        <View
          style={styles.dots}
          accessible
          accessibilityRole="text"
          accessibilityLabel={interpolate(t.intro.pageOf, {
            current: index + 1,
            total: PAGES.length,
          })}
        >
          {PAGES.map((page, dotIndex) => (
            <View key={page.key} style={[styles.dot, dotIndex === index && styles.dotActive]} />
          ))}
        </View>

        {isLast ? (
          <>
            <Button label={t.intro.getStarted} onPress={() => finish('signup')} fullWidth />
            <Button
              label={t.intro.haveAccount}
              variant="secondary"
              onPress={() => finish('signin')}
              fullWidth
            />
          </>
        ) : (
          // For people who cannot swipe (for example with a screen reader).
          <Button
            label={t.common.next}
            variant="secondary"
            onPress={() => goTo(index + 1)}
            fullWidth
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    alignItems: 'flex-end',
  },
  page: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing[8],
    paddingHorizontal: spacing[6],
  },
  text: {
    gap: spacing[2],
  },
  bottom: {
    gap: spacing[3],
    paddingTop: spacing[4],
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: radii.pill,
    backgroundColor: colors.lineStrong,
  },
  dotActive: {
    width: DOT_SIZE * 3,
    backgroundColor: colors.gym,
  },
});
