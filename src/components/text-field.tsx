import { CircleAlert } from 'lucide-react-native';
import { useId, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { colors, radii, sizes, spacing, typography } from '@/theme';

export type TextFieldProps = Omit<TextInputProps, 'style' | 'keyboardType' | 'inputMode'> & {
  label: string;
  error?: string;
  // Decimal keypad for weights, times and distances.
  numeric?: boolean;
};

export function TextField({
  label,
  error,
  numeric = false,
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) {
  const labelId = useId();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.container}>
      <AppText variant="caption" color="textSoft" nativeID={labelId}>
        {label}
      </AppText>
      <TextInput
        {...inputProps}
        accessibilityLabel={label}
        accessibilityLabelledBy={labelId}
        accessibilityHint={error}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        inputMode={numeric ? 'decimal' : 'text'}
        placeholderTextColor={colors.dim}
        selectionColor={colors.gym}
        cursorColor={colors.gym}
        allowFontScaling
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          numeric && styles.numeric,
          focused && styles.focused,
          error !== undefined && styles.invalid,
        ]}
      />
      {error !== undefined && (
        <View style={styles.error}>
          <Icon icon={CircleAlert} size="sm" color="danger" />
          <AppText
            variant="caption"
            color="danger"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={styles.errorText}
          >
            {error}
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[2],
  },
  input: {
    ...typography.body,
    color: colors.text,
    minHeight: sizes.control,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: sizes.border,
    borderRadius: radii.md,
  },
  numeric: {
    ...typography.numeric,
  },
  focused: {
    borderColor: colors.gym,
  },
  invalid: {
    borderColor: colors.danger,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  errorText: {
    flexShrink: 1,
  },
});
