import { useCallback, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ArrowLeft, Download, Globe, LogOut, Trash2 } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { ListRow } from '@/components/ui/ListRow';
import { ProfileCard } from '@/components/ui/ProfileCard';
import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import { BACKEND } from '@/lib/env';
import { getSupabase } from '@/lib/supabase';
import { exportMyData } from '@/services/export';
import { useAuthStore } from '@/store/useAuthStore';
import { useProfileStore } from '@/store/useProfileStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';

const APPEARANCE_OPTIONS = [
  { label: 'Claro', value: 'light' },
  { label: 'Oscuro', value: 'dark' },
  { label: 'Auto', value: 'auto' },
];

const MAX_NAME = 40;

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

type Sheet = 'none' | 'everywhere' | 'delete' | 'deleteEverywhere';

/**
 * Pantalla «Cuenta» (A5): correo, nombre editable, apariencia, exportar,
 * cerrar sesión (1 / todos), borrar cuenta (frase BORRAR MI CUENTA) y el
 * enlace de borrado global de la identidad VERTICE. En modo mock muestra
 * «Modo demostración» y oculta las acciones de cuenta.
 */
export default function AccountScreen() {
  const email = useAuthStore((s) => s.email);
  const provider = useAuthStore((s) => s.provider);
  const signOut = useAuthStore((s) => s.signOut);
  const signOutEverywhere = useAuthStore((s) => s.signOutEverywhere);
  const displayName = useProfileStore((s) => s.profile.displayName);
  const setDisplayName = useProfileStore((s) => s.setDisplayName);
  const appearance = useSettingsStore((s) => s.appearance);
  const setAppearance = useSettingsStore((s) => s.setAppearance);
  const toast = useToast();

  const [nameDraft, setNameDraft] = useState(displayName);
  const [exporting, setExporting] = useState(false);
  const [sheet, setSheet] = useState<Sheet>('none');
  const isMock = BACKEND === 'mock';

  const { colors } = useTheme();
  const styles = useThemedStyles((c) => StyleSheet.create({
    content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 14 },
    headerRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.card,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    title: { color: c.ink, flex: 1 },
    groupLabel: { color: c.mut, marginTop: 8 },
    nameRow: { paddingVertical: 12, gap: 8 },
    demoBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 99,
      backgroundColor: c.chip,
      alignSelf: 'flex-start',
    },
    demoText: { color: c.mut },
    footer: { marginTop: 24, alignItems: 'center' as const, gap: 4 },
    footerText: { color: c.mut },
    legal: { color: c.acc },
  }));

  const providerLabel = provider === 'google' ? 'Entras con Google' : 'Entras con código por correo';

  const saveName = useCallback(() => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === displayName) {
      setNameDraft(displayName);
      return;
    }
    setDisplayName(trimmed.slice(0, MAX_NAME));
    toast.show('Nombre guardado');
  }, [nameDraft, displayName, setDisplayName, toast]);

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    const res = await exportMyData();
    setExporting(false);
    toast.show(res.message, 3000, !res.ok);
  }, [exporting, toast]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace('/login');
  }, [signOut]);

  const confirmSignOutEverywhere = useCallback(async () => {
    setSheet('none');
    await signOutEverywhere();
    router.replace('/login');
  }, [signOutEverywhere]);

  const runDelete = useCallback(
    async (everywhere: boolean) => {
      setSheet('none');
      try {
        const { error } = await getSupabase().functions.invoke('delete-account', {
          body: { everywhere },
        });
        if (error) throw error;
        await signOut();
        router.replace('/login');
      } catch {
        toast.show('No se pudo borrar la cuenta. Inténtalo de nuevo.', 4000, true);
      }
    },
    [signOut, toast],
  );

  return (
    <Screen safe={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Atrás"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ArrowLeft size={20} color={colors.ink} strokeWidth={2} />
          </Pressable>
          <Text accessibilityRole="header" style={[textStyle('screenTitle'), styles.title]}>
            Cuenta
          </Text>
          <View style={{ width: 40, height: 40 }} />
        </View>

        <Card>
          <ProfileCard
            name={displayName || (email ? email.split('@')[0] : 'Usuario')}
            subtitle={email ?? ''}
            initial={(displayName || email || 'U').charAt(0).toUpperCase()}
          />
        </Card>

        {/* Información */}
        <Text style={[textStyle('label'), styles.groupLabel]}>INFORMACIÓN</Text>
        <Card>
          <ListRow first title="Correo" subtitle={providerLabel} value={email ?? ''} />
          <View style={styles.nameRow}>
            <TextField
              label="Nombre visible"
              value={nameDraft}
              onChangeText={(t) => setNameDraft(t.slice(0, MAX_NAME))}
              onBlur={saveName}
              onSubmitEditing={saveName}
              placeholder="Tu nombre"
              maxLength={MAX_NAME}
              testID="account-name-input"
            />
          </View>
        </Card>

        {/* Aplicación */}
        <Text style={[textStyle('label'), styles.groupLabel]}>APARIENCIA</Text>
        <Card>
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
            {/* Cuenta */}
            <Text style={[textStyle('label'), styles.groupLabel]}>CUENTA</Text>
            <Card>
              <ListRow
                first
                title="Exportar mis datos"
                subtitle="Descarga un JSON con todo lo tuyo en Diana"
                icon={Download}
                onPress={() => void handleExport()}
              />
              <ListRow
                title="Cerrar sesión"
                subtitle="Solo este dispositivo"
                icon={LogOut}
                onPress={() => void handleSignOut()}
              />
              <ListRow
                title="Cerrar en todos los dispositivos"
                icon={Globe}
                onPress={() => setSheet('everywhere')}
              />
              <ListRow
                title="Borrar mi cuenta"
                subtitle="Borra tus datos de Diana"
                icon={Trash2}
                onPress={() => setSheet('delete')}
              />
            </Card>

            <Card>
              <ListRow
                first
                title="Borrar también mi acceso a todas las apps de VERTICE"
                subtitle="Elimina además la cuenta compartida: afectará a Diana y a las demás apps"
                icon={Trash2}
                iconColor={colors.neg}
                onPress={() => setSheet('deleteEverywhere')}
              />
            </Card>
          </>
        )}

        {/* Pie */}
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Política de privacidad"
            onPress={() => {
              if (Platform.OS === 'web') window.open('/privacidad.html', '_blank');
              else Linking.openURL('https://marcosariasglez.github.io/diana/privacidad.html');
            }}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={[textStyle('bodySmall'), styles.footerText]}>
              <Text style={styles.legal}>Política de privacidad</Text>
              {'  ·  '}
              <Text style={styles.legal} onPress={() => {
                if (Platform.OS === 'web') window.open('/terminos.html', '_blank');
                else Linking.openURL('https://marcosariasglez.github.io/diana/terminos.html');
              }}>Términos</Text>
            </Text>
          </Pressable>
          <Text style={[textStyle('bodySmall'), styles.footerText]}>
            Diana {APP_VERSION} · Una app de VERTICE
          </Text>
        </View>
      </ScrollView>

      <ConfirmSheet
        visible={sheet === 'everywhere'}
        title="Cerrar en todos los dispositivos"
        message="Se cerrará la sesión de Diana en todos tus dispositivos. Volverás a entrar cuando quieras."
        confirmLabel="Cerrar"
        onConfirm={() => void confirmSignOutEverywhere()}
        onCancel={() => setSheet('none')}
      />
      <ConfirmSheet
        visible={sheet === 'delete'}
        title="Borrar mi cuenta"
        message="Se borrarán todos tus datos de Diana (perfil, historial, salas). Esta acción no se puede deshacer."
        requirePhrase="BORRAR MI CUENTA"
        phraseHint="Escribe BORRAR MI CUENTA para confirmar"
        confirmLabel="Borrar"
        destructive
        onConfirm={() => void runDelete(false)}
        onCancel={() => setSheet('none')}
      />
      <ConfirmSheet
        visible={sheet === 'deleteEverywhere'}
        title="Borrar mi acceso a VERTICE"
        message="Se borrarán tus datos de Diana y además tu cuenta compartida de VERTICE. Perderás el acceso a todas las apps del grupo. Esta acción no se puede deshacer."
        requirePhrase="BORRAR MI CUENTA"
        phraseHint="Escribe BORRAR MI CUENTA para confirmar"
        confirmLabel="Borrar todo"
        destructive
        onConfirm={() => void runDelete(true)}
        onCancel={() => setSheet('none')}
      />
    </Screen>
  );
}
