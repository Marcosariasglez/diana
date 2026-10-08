import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { TextField } from './TextField';

export interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  message: string;
  /** Frase exacta que el usuario debe escribir para confirmar (opcional). */
  requirePhrase?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Texto de ayuda bajo el campo de frase. */
  phraseHint?: string;
}

/**
 * Diálogo de confirmación A3.4: título 20/800, texto 14.5 mut, dos botones
 * (el destructivo a la derecha). Para acciones irreversibles exige escribir
 * una frase exacta y bloquea el botón de confirmar hasta que sea exacta.
 */
export function ConfirmSheet({
  visible,
  title,
  message,
  requirePhrase,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  onConfirm,
  onCancel,
  phraseHint,
}: ConfirmSheetProps) {
  const [phrase, setPhrase] = useState('');
  const styles = useThemedStyles((c) =>
    StyleSheet.create({
      content: {
        padding: 20,
        gap: 16,
      },
      title: { color: c.ink },
      message: { color: c.mut },
      buttons: {
        flexDirection: 'row' as const,
        gap: 12,
      },
      hint: { color: c.mut },
    }),
  );

  // Al cerrar se limpia la frase escrita.
  useEffect(() => {
    if (!visible) setPhrase('');
  }, [visible]);

  const phraseOk = !requirePhrase || phrase === requirePhrase;

  return (
    <BottomSheet visible={visible} onClose={onCancel}>
      <View style={styles.content}>
        <Text
          style={[
            textStyle('sectionTitle', { fontFamily: 'Manrope-ExtraBold' }),
            { fontSize: 20 },
            styles.title,
          ]}
        >
          {title}
        </Text>
        <Text style={[textStyle('body'), { fontSize: 14.5 }, styles.message]}>{message}</Text>
        {requirePhrase ? (
          <>
            <TextField
              label="Confirmación"
              placeholder={requirePhrase}
              value={phrase}
              onChangeText={setPhrase}
              testID="confirm-phrase-input"
              accessibilityLabel={`Escribe ${requirePhrase} para confirmar`}
            />
            {phraseHint ? (
              <Text style={[textStyle('bodySmall'), styles.hint]}>{phraseHint}</Text>
            ) : null}
          </>
        ) : null}
        <View style={styles.buttons}>
          <View style={{ flex: 1 }}>
            <Button label={cancelLabel} variant="secondary" onPress={onCancel} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={confirmLabel}
              variant={destructive ? 'destructive' : 'primary'}
              disabled={!phraseOk}
              onPress={onConfirm}
              accessibilityLabel={confirmLabel}
            />
          </View>
        </View>
      </View>
    </BottomSheet>
  );
}
