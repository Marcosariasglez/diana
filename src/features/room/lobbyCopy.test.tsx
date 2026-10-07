import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { ToastProvider } from '@/components/ui/Toast';
import type { RoomMember } from '@/types/room';
import { RoomLobby } from './RoomLobby';

const members: RoomMember[] = [
  { userId: 'user-me', name: 'Juan', initial: 'J', isReady: true },
  { userId: 'maria', name: 'María', initial: 'M', isReady: true },
];

const setString = Clipboard.setStringAsync as jest.Mock;

function renderLobby(over: Partial<React.ComponentProps<typeof RoomLobby>> = {}) {
  return render(
    <ToastProvider>
      <RoomLobby
        code="X49B"
        members={members}
        hostId="user-me"
        currentUserId="user-me"
        allReady
        onStart={jest.fn()}
        onToggleReady={jest.fn()}
        onBack={jest.fn()}
        {...over}
      />
    </ToastProvider>,
  );
}

describe('Lobby: copiar codigo', () => {
  beforeEach(() => setString.mockReset());

  it('copia X49B una vez y muestra "Código copiado"', async () => {
    setString.mockResolvedValue(true);
    await renderLobby();
    await fireEvent.press(screen.getByLabelText('Copiar código de sala'));
    await waitFor(() => expect(screen.getByText('Código copiado')).toBeTruthy());
    expect(setString).toHaveBeenCalledTimes(1);
    expect(setString).toHaveBeenCalledWith('X49B');
  });

  it('si el portapapeles rechaza muestra "No se pudo copiar el código"', async () => {
    setString.mockRejectedValue(new Error('denied'));
    await renderLobby();
    await fireEvent.press(screen.getByLabelText('Copiar código de sala'));
    await waitFor(() => expect(screen.getByText('No se pudo copiar el código')).toBeTruthy());
    expect(screen.queryByText('Código copiado')).toBeNull();
  });
});

describe('Lobby: acciones', () => {
  it('anfitrion con todos listos: boton de comenzar habilitado', async () => {
    const onStart = jest.fn();
    await renderLobby({ onStart });
    expect(screen.getByText('En la sala')).toBeTruthy();
    expect(screen.getByText('2 de 6')).toBeTruthy();
    expect(screen.getByText('Anfitrión')).toBeTruthy();
    expect(screen.getAllByText('Libre')).toHaveLength(4);
    await fireEvent.press(screen.getByLabelText('Comenzar Match (Todos listos)'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('anfitrion sin todos listos: boton deshabilitado', async () => {
    const onStart = jest.fn();
    await renderLobby({ onStart, allReady: false });
    await fireEvent.press(screen.getByLabelText('Comenzar Match (Todos listos)'));
    expect(onStart).not.toHaveBeenCalled();
  });

  it('no anfitrion: "Estoy listo" / "Quitar listo" y sin boton de comenzar', async () => {
    const onToggleReady = jest.fn();
    await renderLobby({
      hostId: 'maria',
      members: [
        { userId: 'maria', name: 'María', initial: 'M', isReady: true },
        { userId: 'user-me', name: 'Juan', initial: 'J', isReady: false },
      ],
      onToggleReady,
    });
    expect(screen.queryByLabelText('Comenzar Match (Todos listos)')).toBeNull();
    expect(screen.getByText('Solo el anfitrión puede comenzar')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Estoy listo'));
    expect(onToggleReady).toHaveBeenCalledWith(true);
  });
});
