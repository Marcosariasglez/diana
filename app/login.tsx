import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleButton } from '@/components/ui/GoogleButton';
import { Button } from '@/components/ui/Button';
import { useThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';
import { useAuthStore } from '@/store/useAuthStore';

const RESEND_COOLDOWN = 30;

export default function Login() {
  const { colors: c } = useTheme();
  const error = useAuthStore((s) => s.error);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const sendEmailCode = useAuthStore((s) => s.sendEmailCode);
  const verifyEmailCode = useAuthStore((s) => s.verifyEmailCode);

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const styles = useThemedStyles((c) => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 20,
      maxWidth: 380,
      alignSelf: 'center',
      width: '100%',
      gap: 16,
    },
    logo: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.acc,
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    logoText: { color: c.onAcc },
    title: { color: c.ink, textAlign: 'center' as const },
    subtitle: { color: c.mut, textAlign: 'center' as const },
    separator: {
      flexDirection: 'row' as const,
      alignItems: 'center',
      gap: 12,
    },
    separatorLine: {
      flex: 1,
      height: 1,
      backgroundColor: c.line,
    },
    separatorText: { color: c.mut },
    input: {
      minHeight: 52,
      borderRadius: 16,
      backgroundColor: c.card,
      paddingHorizontal: 16,
      color: c.ink,
      fontSize: 16,
      borderWidth: 1,
      borderColor: c.lineStrong,
    },
    codeInput: {
      minHeight: 52,
      borderRadius: 16,
      backgroundColor: c.card,
      paddingHorizontal: 16,
      color: c.ink,
      fontSize: 24,
      letterSpacing: 8,
      textAlign: 'center' as const,
      borderWidth: 1,
      borderColor: c.lineStrong,
    },
    error: { color: c.neg, minHeight: 20, textAlign: 'center' as const },
    footer: {
      alignItems: 'center' as const,
      gap: 4,
      paddingVertical: 24,
    },
    footerText: { color: c.mut },
    link: { color: c.acc },
  }));

  const startCooldown = useCallback(() => {
    setCooldown(RESEND_COOLDOWN);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleSendCode = async () => {
    setBusy(true);
    const ok = await sendEmailCode(email);
    setBusy(false);
    if (ok) {
      setSent(true);
      startCooldown();
    }
  };

  const handleVerify = async () => {
    setBusy(true);
    await verifyEmailCode(email, code);
    setBusy(false);
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setBusy(true);
    const ok = await sendEmailCode(email);
    setBusy(false);
    if (ok) startCooldown();
  };

  const isValidEmail = email.includes('@') && email.includes('.');

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logo}>
            <Text style={[textStyle('heroTitle'), { fontSize: 28 }, styles.logoText]}>D</Text>
          </View>
          <Text accessibilityRole="header" style={[textStyle('heroTitle'), styles.title]}>Diana</Text>
          <Text style={[textStyle('body'), styles.subtitle]}>Tu cine, con tu gusto.</Text>

          <GoogleButton onPress={() => { void signInWithGoogle(); }} disabled={busy} />

          <View style={styles.separator}>
            <View style={styles.separatorLine} />
            <Text style={[textStyle('label'), styles.separatorText]}>O CON UN CÓDIGO POR CORREO</Text>
            <View style={styles.separatorLine} />
          </View>

          {sent ? (
            <>
              <TextInput
                accessibilityLabel="Código de verificación"
                accessibilityHint="6 dígitos"
                placeholder="000000"
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                autoFocus
                style={styles.codeInput}
              />
              <Button
                label="Entrar"
                variant="primary"
                loading={busy}
                disabled={code.length < 6}
                onPress={handleVerify}
              />
              <Pressable
                onPress={handleResend}
                disabled={cooldown > 0}
                accessibilityRole="button"
                accessibilityLabel={cooldown > 0 ? `Reenviar código en ${cooldown} segundos` : 'Reenviar código'}
                style={{ alignItems: 'center', minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={[textStyle('bodySmall'), { color: cooldown > 0 ? c.mut : c.acc }]}>
                  {cooldown > 0 ? `Reenviar código (${cooldown}s)` : 'Reenviar código'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => { setEmail(''); setCode(''); }}
                accessibilityRole="button"
                accessibilityLabel="Cambiar correo"
                style={{ alignItems: 'center', minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={[textStyle('bodySmall'), styles.link]}>Cambiar correo</Text>
              </Pressable>
            </>
          ) : (
            <>
              <TextInput
                accessibilityLabel="Correo electrónico"
                placeholder="tu@correo.com"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                style={styles.input}
                returnKeyType="next"
                onSubmitEditing={isValidEmail ? handleSendCode : undefined}
              />
              <Button
                label="Enviar código"
                variant="secondary"
                loading={busy}
                disabled={!isValidEmail}
                onPress={handleSendCode}
              />
            </>
          )}

          <Text
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={styles.error}
            testID="login-error"
          >
            {error ?? ''}
          </Text>

          <View style={styles.footer}>
            <Text style={[textStyle('bodySmall'), styles.footerText]}>
              Al continuar aceptas la Política de privacidad y los Términos.
            </Text>
            <Text style={[textStyle('bodySmall'), styles.footerText]}>
              Una app de VERTICE
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
