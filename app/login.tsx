import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleButton } from '@/components/ui/GoogleButton';
import { Button } from '@/components/ui/Button';
import { AUTH_MESSAGES, type AuthErrorCode } from '@/constants/authMessages';
import { useAuthStore } from '@/store/useAuthStore';
import { useThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';

const RESEND_COOLDOWN = 30;
const CODE_LENGTH = 6;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Pantalla de acceso A4 (idéntica a la de Norte):
 * logotipo 56 + nombre 32/800 + subtítulo · Google · separador · correo ·
 * «Enviar código» (deshabilitado hasta que el correo parezca válido) · tras
 * enviar, SIN cambiar de pantalla: código de 6 dígitos (one-time-code),
 * «Entrar», «Reenviar» con enfriamiento de 30 s y «Cambiar correo» ·
 * línea de error reservada (aria-live) · pie legal.
 */
export default function Login() {
  const { colors: c } = useTheme();
  const error = useAuthStore((s) => s.error);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const sendEmailCode = useAuthStore((s) => s.sendEmailCode);
  const verifyEmailCode = useAuthStore((s) => s.verifyEmailCode);
  const clearError = useAuthStore((s) => s.clearError);

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const emailRef = useRef<TextInput>(null);

  const styles = useThemedStyles((c) => StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 20,
      maxWidth: 380,
      width: '100%',
      alignSelf: 'center',
      gap: 16,
    },
    // Logotipo A3.4: cuadrado de esquinas redondeadas (34 px radio 11; a 56 px, radio 18),
    // fondo acc + glifo onAcc. No es un círculo.
    logo: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: c.acc,
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoText: { color: c.onAcc },
    title: { color: c.ink, textAlign: 'center' as const },
    subtitle: { color: c.mut, textAlign: 'center' as const },
    separator: { flexDirection: 'row' as const, alignItems: 'center', gap: 12 },
    separatorLine: { flex: 1, height: 1, backgroundColor: c.line },
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
      fontVariant: ['tabular-nums'],
    },
    error: { color: c.neg, minHeight: 20, textAlign: 'center' as const },
    footer: { alignItems: 'center' as const, gap: 4, paddingVertical: 24 },
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

  // Foco inicial en el correo (A4 accesibilidad).
  useEffect(() => {
    const t = setTimeout(() => emailRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const isValidEmail = EMAIL_RE.test(email.trim());

  const handleSendCode = useCallback(async () => {
    if (busy || !isValidEmail) return;
    clearError();
    setBusy(true);
    const ok = await sendEmailCode(email.trim());
    setBusy(false);
    if (ok) {
      setSent(true);
      setCode('');
      startCooldown();
    }
  }, [busy, isValidEmail, email, sendEmailCode, clearError, startCooldown]);

  const handleVerify = useCallback(async () => {
    if (busy || code.length !== CODE_LENGTH) return;
    clearError();
    setBusy(true);
    await verifyEmailCode(email.trim(), code);
    setBusy(false);
  }, [busy, code, email, verifyEmailCode, clearError]);

  const handleResend = useCallback(async () => {
    if (busy || cooldown > 0) return;
    clearError();
    setBusy(true);
    const ok = await sendEmailCode(email.trim());
    setBusy(false);
    if (ok) startCooldown();
  }, [busy, cooldown, email, sendEmailCode, clearError, startCooldown]);

  const handleGoogle = useCallback(async () => {
    if (busy) return;
    clearError();
    setBusy(true);
    await signInWithGoogle();
    setBusy(false);
  }, [busy, signInWithGoogle, clearError]);

  const handleBackToEmail = useCallback(() => {
    clearError();
    setSent(false);
    setCode('');
    emailRef.current?.focus();
  }, [clearError]);

  const errorMessage = error ? AUTH_MESSAGES[error as AuthErrorCode] : null;

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
          <Text accessibilityRole="header" style={[textStyle('heroTitle'), styles.title]}>
            Diana
          </Text>
          <Text style={[textStyle('body'), styles.subtitle]}>Tu cine, con tu gusto.</Text>

          <GoogleButton onPress={handleGoogle} disabled={busy} />

          <View style={styles.separator}>
            <View style={styles.separatorLine} />
            <Text style={[textStyle('label'), styles.separatorText]}>O CON UN CÓDIGO POR CORREO</Text>
            <View style={styles.separatorLine} />
          </View>

          {sent ? (
            <>
              <TextInput
                testID="login-code-input"
                accessibilityLabel="Código de verificación"
                accessibilityHint={`${CODE_LENGTH} dígitos`}
                placeholder={'0'.repeat(CODE_LENGTH)}
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, CODE_LENGTH))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                inputMode="numeric"
                autoFocus
                style={styles.codeInput}
                returnKeyType="done"
                onSubmitEditing={code.length === CODE_LENGTH ? handleVerify : undefined}
              />
              <Button
                label="Entrar"
                variant="primary"
                loading={busy}
                disabled={code.length !== CODE_LENGTH}
                onPress={handleVerify}
              />
              <Pressable
                onPress={handleResend}
                disabled={cooldown > 0 || busy}
                accessibilityRole="button"
                accessibilityLabel={cooldown > 0 ? `Reenviar código en ${cooldown} segundos` : 'Reenviar código'}
                style={{ alignItems: 'center', minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={[textStyle('bodySmall'), { color: cooldown > 0 ? c.mut : c.acc, fontFamily: 'Inter-SemiBold' }]}>
                  {cooldown > 0 ? `Reenviar código (${cooldown}s)` : 'Reenviar código'}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleBackToEmail}
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
                ref={emailRef}
                testID="login-email-input"
                accessibilityLabel="Correo electrónico"
                placeholder="tu@correo.com"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (error) clearError();
                }}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                inputMode="email"
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

          {/* Línea de error reservada (no salta nada al aparecer). */}
          <Text
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={styles.error}
            testID="login-error"
          >
            {errorMessage ?? ''}
          </Text>

          <View style={styles.footer}>
            <Text style={[textStyle('bodySmall'), styles.footerText]}>
              Al continuar aceptas la{' '}
              <Text
                style={styles.link}
                onPress={() => {
                  if (Platform.OS === 'web') window.open('/privacidad.html', '_blank');
                  else void Linking.openURL('https://marcosariasglez.github.io/diana/privacidad.html');
                }}
              >
                Política de privacidad
              </Text>{' '}
              y los{' '}
              <Text
                style={styles.link}
                onPress={() => {
                  if (Platform.OS === 'web') window.open('/terminos.html', '_blank');
                  else void Linking.openURL('https://marcosariasglez.github.io/diana/terminos.html');
                }}
              >
                Términos
              </Text>
              .
            </Text>
            <Text style={[textStyle('bodySmall'), styles.footerText]}>Una app de VERTICE</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
