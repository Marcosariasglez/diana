import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft, Trash2, Download, LogOut } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { ProfileCard } from '@/components/ui/ProfileCard';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Screen } from '@/components/ui/Screen';
import { useAuthStore } from '@/store/useAuthStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { getSupabase } from '@/lib/supabase';
import { BACKEND } from '@/lib/env';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';

const APPEARANCE_OPTIONS = [
  { label: 'Claro', value: 'light' },
  { label: 'Oscuro', value: 'dark' },
  { label: 'Auto', value: 'auto' },
];

export default function AccountScreen() {
  const email = useAuthStore((s) => s.email);
  const signOut = useAuthStore((s) => s.signOut);
  const appearance = useSettingsStore((s) => s.appearance);
  const setAppearance = useSettingsStore((s) => s.setAppearance);
  const [showDelete, setShowDelete] = useState(false);
  const isMock = BACKEND === 'mock';
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => StyleSheet.create({
    content: { paddingHorizontal: 20, paddingTop: 80, paddingBottom: 40, gap: 14 },
    groupLabel: { color: c.mut, marginTop: 8 },
    footer: { marginTop: 24, alignItems: 'center' as const, gap: 4 },
    footerText: { color: c.mut },
    demoBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 99,
      backgroundColor: c.chip,
      alignSelf: 'center',
      marginBottom: 8,
    },
    demoText: { color: c.mut },
    sectionGap: { gap: 0 },
    backButton: {
      position: 'absolute' as const,
      top: 60,
      left: 20,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.card,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      zIndex: 5,
    },
  }));

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace('/login');
  }, [signOut]);

  const handleSignOutEverywhere = useCallback(async () => {
    try {
      await getSupabase().auth.signOut({ scope: 'global' });
      router.replace('/login');
    } catch {
      await signOut();
      router.replace('/login');
    }
  }, [signOut]);

  const handleDeleteAccount = useCallback(async () => {
    try {
      await getSupabase().functions.invoke('delete-account', {
        body: { everywhere: false },
      });
      await signOut();
      router.replace('/login');
    } catch {
      Alert.alert('Error', 'No se pudo borrar la cuenta. Inténtalo de nuevo.');
    }
    setShowDelete(false);
  }, [signOut]);

  const provider = 'Google';

  useFocusEffect(
    useCallback(() => {}, []),
  );

  return (
    <Screen safe={false}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Atrás"
        onPress={() => router.back()}
        style={styles.backButton}
      >
        <ArrowLeft size={20} color={colors.ink} strokeWidth={2} />
      </Pressable>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text accessibilityRole="header" style={[textStyle('screenTitle'), { marginBottom: 8 }]}>
          Cuenta
        </Text>

        <ProfileCard
          name={email?.split('@')[0] ?? 'Usuario'}
          subtitle={email ?? ''}
          initial={(email ?? 'U').charAt(0).toUpperCase()}
        />

        {/* Información */}
        <Text style={[textStyle('label'), styles.groupLabel]}>INFORMACIÓN</Text>
        <Card style={styles.sectionGap}>
          <ListRow
            first
            title="Correo"
            subtitle={`Entras con ${provider}`}
            value={email ?? ''}
          />
        </Card>

        {/* Apariencia */}
        <Text style={[textStyle('label'), styles.groupLabel]}>APARIENCIA</Text>
        <Card style={styles.sectionGap}>
          <SegmentedControl
            options={APPEARANCE_OPTIONS}
            selected={appearance}
            onChange={(v) => setAppearance(v as 'light' | 'dark' | 'auto')}
          />
        </Card>

        {isMock ? (
          <View style={styles.demoBadge}>
            <Text style={[textStyle('bodySmall'), styles.demoText]}>Modo demostración</Text>
          </View>
        ) : (
          <>
            {/* Acciones */}
            <Text style={[textStyle('label'), styles.groupLabel]}>ACCIONES</Text>
            <Card style={styles.sectionGap}>
              <ListRow
                first
                title="Exportar mis datos"
                subtitle="Descarga un JSON con todos tus datos"
                icon={Download}
                onPress={() => Alert.alert('Próximamente', 'Exportar datos estará disponible pronto.')}
              />
              <ListRow
                title="Cerrar sesión"
                subtitle="Solo este dispositivo"
                icon={LogOut}
                onPress={handleSignOut}
              />
              <ListRow
                title="Cerrar en todos los dispositivos"
                icon={LogOut}
                onPress={() => Alert.alert(
                  'Cerrar en todos los dispositivos',
                  'Se cerrará la sesión en todos los dispositivos.',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Cerrar', onPress: handleSignOutEverywhere },
                  ],
                )}
              />
              <ListRow
                title="Borrar mi cuenta"
                subtitle="Acción irreversible"
                icon={Trash2}
                onPress={() => setShowDelete(true)}
              />
            </Card>
          </>
        )}

        {/* Pie */}
        <View style={styles.footer}>
          <Text style={[textStyle('bodySmall'), styles.footerText]}>
            Política de privacidad · Términos de uso
          </Text>
          <Text style={[textStyle('bodySmall'), styles.footerText]}>
            Una app de VERTICE
          </Text>
        </View>
      </ScrollView>

      <ConfirmSheet
        visible={showDelete}
        title="Borrar mi cuenta"
        message="Se borrarán todos tus datos de Diana. Esta acción no se puede deshacer."
        requirePhrase="BORRAR MI CUENTA"
        confirmLabel="Borrar"
        destructive
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDelete(false)}
        phraseHint="Escribe BORRAR MI CUENTA para confirmar"
      />
    </Screen>
  );
}
