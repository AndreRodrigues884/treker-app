import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';

import { colors, fontFamilies, sizes, spacing, typography } from '@/theme';

export type TrendChartPoint = {
  value: number;
  // Shown under the point; leave empty to skip a label (long series).
  label: string;
  // Drawn in the record colour (a point that was a personal record).
  highlight?: boolean;
};

export type TrendChartProps = {
  kind: 'line' | 'bar';
  points: readonly TrendChartPoint[];
  // What the chart shows, in words: screen readers read this instead of the drawing.
  summary: string;
  // The y axis labels ("120", "1,2k"); numbers only, the unit is in the title.
  formatValue?: (value: number) => string;
};

const HEIGHT = sizes.minTouch * 4;
const Y_LABEL_WIDTH = sizes.minTouch;
const EDGE = spacing[3];
const MIN_SPACING = spacing[4];

const axisText = {
  color: colors.muted,
  fontFamily: fontFamilies.monoRegular,
  fontSize: typography.caption.fontSize,
};

/**
 * A line or bar chart over time, in the theme's colours with Geist Mono numbers (built on
 * react-native-gifted-charts, which draws with react-native-svg and runs in Expo Go). Highlighted
 * points are drawn in the record colour. It fits the width it is given and scrolls sideways only
 * when there are too many points. For screen readers the drawing is hidden and `summary` is read.
 */
export function TrendChart({ kind, points, summary, formatValue }: TrendChartProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const plotWidth = Math.max(0, width - Y_LABEL_WIDTH - EDGE * 2);
  const gaps = Math.max(1, points.length - (kind === 'line' ? 1 : 0));
  const step = Math.max(MIN_SPACING, plotWidth / gaps);
  const maxValue = Math.max(1, ...points.map((point) => point.value));
  // Some headroom above the highest point.
  const ceiling = maxValue * 1.1;
  const yFormat = formatValue ? (label: string) => formatValue(Number(label)) : undefined;

  return (
    <View
      style={styles.container}
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={summary}
    >
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {width > 0 && points.length > 0 && kind === 'line' && (
          <LineChart
            data={points.map((point) => ({
              value: point.value,
              label: point.label,
              dataPointColor: point.highlight ? colors.record : colors.gym,
              dataPointRadius: point.highlight ? spacing[1] + 1 : spacing[1] - 1,
            }))}
            height={HEIGHT}
            width={plotWidth}
            spacing={points.length > 1 ? step : 0}
            initialSpacing={EDGE}
            endSpacing={EDGE}
            maxValue={ceiling}
            noOfSections={4}
            color={colors.gym}
            thickness={sizes.border * 2}
            yAxisLabelWidth={Y_LABEL_WIDTH}
            yAxisTextStyle={axisText}
            xAxisLabelTextStyle={axisText}
            yAxisColor={colors.line}
            xAxisColor={colors.line}
            rulesColor={colors.divider}
            formatYLabel={yFormat}
            disableScroll={step * gaps <= plotWidth}
          />
        )}
        {width > 0 && points.length > 0 && kind === 'bar' && (
          <BarChart
            data={points.map((point) => ({
              value: point.value,
              label: point.label,
              frontColor: point.highlight ? colors.record : colors.gym,
            }))}
            height={HEIGHT}
            width={plotWidth}
            barWidth={Math.max(spacing[2], Math.min(spacing[6], step * 0.6))}
            spacing={Math.max(spacing[1], step * 0.4)}
            initialSpacing={EDGE}
            endSpacing={EDGE}
            maxValue={ceiling}
            noOfSections={4}
            yAxisLabelWidth={Y_LABEL_WIDTH}
            yAxisTextStyle={axisText}
            xAxisLabelTextStyle={axisText}
            yAxisColor={colors.line}
            xAxisColor={colors.line}
            rulesColor={colors.divider}
            formatYLabel={yFormat}
            disableScroll={step * gaps <= plotWidth}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: HEIGHT + spacing[8],
  },
});
