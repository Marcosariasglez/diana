import { forwardRef, useState } from 'react';
import { StyleSheet, Text, TextInput, type TextInputProps } from 'react-native';
import { useThemedStyles } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(
  ({ label, error, placeholder, ...rest }, ref) => {
    const [focused, setFocused] = useState(false);
    const styles = useThemedStyles((c) =>
      StyleSheet.create({
        input: {
          minHeight: 52,
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: c.card,
          borderWidth: focused ? 2 : 1,
          borderColor: error ? c.neg : focused ? c.acc : c.lineStrong,
        },
        text: { color: c.ink },
        placeholder: { color: c.mut },
        errorText: { color: c.neg, marginTop: 4 },
      }),
    );

    return (
      <>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error}
          placeholder={placeholder}
          placeholderTextColor={styles.placeholder.color}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          style={[
            textStyle('body'),
            { fontSize: 16 },
            styles.input,
            styles.text,
          ]}
          {...rest}
        />
        {error ? (
          <Text style={[textStyle('bodySmall'), styles.errorText]}>
            {error}
          </Text>
        ) : null}
      </>
    );
  },
);

TextField.displayName = 'TextField';
