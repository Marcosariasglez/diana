import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { COLORS } from '@/theme/colors';
import { textStyle } from '@/theme/typography';
import { useAuthStore } from '@/store/useAuthStore';

export default function Login() {
  const error = useAuthStore((s) => s.error);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const sendEmailCode = useAuthStore((s) => s.sendEmailCode);
  const verifyEmailCode = useAuthStore((s) => s.verifyEmailCode);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    setSent(await sendEmailCode(email));
    setBusy(false);
  };
  const verify = async () => {
    setBusy(true);
    await verifyEmailCode(email, code);
    setBusy(false);
  };

  return (
    <Screen>
      <View style={styles.wrap}>
        <Text accessibilityRole="header" style={[textStyle('heroTitle'), styles.title]}>Diana</Text>
        <Text style={[textStyle('body'), styles.subtitle]}>
          Inicia sesi\u00f3n para guardar tus valoraciones y jugar con amigos.
        </Text>

        <Button label="Continuar con Google" variant="primary" onPress={() => void signInWithGoogle()} />

        <Text style={[textStyle('label'), styles.or]}>O CON UN C\u00d3DIGO POR CORREO</Text>
        <TextInput
          accessibilityLabel="Correo electr\u00f3nico"
          placeholder="tu@correo.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        {sent ? (
          <>
            <TextInput
              accessibilityLabel="C\u00f3digo de verificaci\u00f3n"
              placeholder="C\u00f3digo"
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 8))}
              keyboardType="number-pad"
              style={styles.input}
            />
            <Button label="Verificar c\u00f3digo" variant="dark" loading={busy} disabled={code.length < 6} onPress={() => void verify()} />
          </>
        ) : (
          <Button label="Enviar c\u00f3digo" variant="secondary" loading={busy} disabled={!email.includes('@')} onPress={() => void send()} />
        )}
        {error ? <Text accessibilityLiveRegion="polite" style={[textStyle('bodySmall'), styles.error]}>{error}</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 14 },
  title: { color: COLORS.textPrimary, textAlign: 'center' },
  subtitle: { color: COLORS.textSecondary, textAlign: 'center', marginBottom: 12 },
  or: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 8 },
  input: {
    minHeight: 52, borderRadius: 16, backgroundColor: COLORS.card, paddingHorizontal: 16,
    color: COLORS.textPrimary, fontSize: 16,
  },
  error: { color: '#B42318', textAlign: 'center' },
});
