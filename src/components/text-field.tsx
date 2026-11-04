import { CircleAlert } from 'lucide-react-native';
import { useId, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { colors, radii, sizes, spacing, typography } from '@/theme';

// decimal: weights, times and distances. integer: digits only, such as sign-in codes.
export type TextFieldKind = 'text' | 'email' | 'decimal' | 'integer';

export type TextFieldProps = Omit<TextInputProps, 'style' | 'keyboardType' | 'inputMode'> & {
  label: string;
  error?: string;
  kind?: TextFieldKind;
};

const keyboards: Record<TextFieldKind, Pick<TextInputProps, 'keyboardType' | 'inputMode'>> = {
  text: { keyboardType: 'default', inputMode: 'text' },
  email: { keyboardType: 'email-address', inputMode: 'email' },
  decimal: { keyboardType: 'decimal-pad', inputMode: 'decimal' },
  integer: { keyboardType: 'number-pad', inputMode: 'numeric' },
};

export function TextField({
  label,
  error,
  kind = 'text',
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) {
  const labelId = useId();
  const [focused, setFocused] = useState(false);
  const numeric = kind === 'decimal' || kind === 'integer';

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
        {...keyboards[kind]}
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
