/**
 * Pruebas de la pantalla de acceso (A4) por estados:
 * vacío, correo inválido, enviado, código malo, error de red, cargando.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AUTH_MESSAGES, type AuthErrorCode } from '@/constants/authMessages';

const mockState: {
  error: AuthErrorCode | null;
  signInWithGoogle: jest.Mock;
  sendEmailCode: jest.Mock;
  verifyEmailCode: jest.Mock;
  clearError: jest.Mock;
} = {
  error: null,
  signInWithGoogle: jest.fn().mockResolvedValue(undefined),
  sendEmailCode: jest.fn().mockResolvedValue(true),
  verifyEmailCode: jest.fn().mockResolvedValue(true),
  clearError: jest.fn(),
};

jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: typeof mockState) => unknown) => sel(mockState),
}));

import Login from '../../app/login';

function setStore(patch: Partial<typeof mockState>) {
  Object.assign(mockState, patch);
}

async function goCodeStep(): Promise<void> {
  const email = screen.getByTestId('login-email-input');
  await fireEvent.changeText(email, 'ana@vertice.app');
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'Enviar código' }));
  });
}

describe('Pantalla de acceso (A4)', () => {
  beforeEach(() => {
    setStore({
      error: null,
      signInWithGoogle: jest.fn().mockResolvedValue(undefined),
      sendEmailCode: jest.fn().mockResolvedValue(true),
      verifyEmailCode: jest.fn().mockResolvedValue(true),
      clearError: jest.fn(),
    });
    jest.clearAllMocks();
  });

  it('estado vacío: botón enviar deshabilitado, sin error', async () => {
    await render(<Login />);
    expect(screen.getByTestId('login-email-input')).toBeTruthy();
    const send = screen.getByRole('button', { name: 'Enviar código' });
    expect(send.props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('login-error').props.children).toBe('');
  });

  it('correo inválido: no envía aunque se pulse', async () => {
    await render(<Login />);
    const input = screen.getByTestId('login-email-input');
    await fireEvent.changeText(input, 'no-es-correo');
    const send = screen.getByRole('button', { name: 'Enviar código' });
    expect(send.props.accessibilityState.disabled).toBe(true);
    await act(async () => {
      fireEvent.press(send);
    });
    expect(mockState.sendEmailCode).not.toHaveBeenCalled();
  });

  it('correo válido + enviar: pasa al paso de código y activa enfriamiento', async () => {
    await render(<Login />);
    await goCodeStep();
    expect(mockState.sendEmailCode).toHaveBeenCalledWith('ana@vertice.app');
    expect(screen.getByTestId('login-code-input')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reenviar código/ }).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText(/Reenviar código \(\d+s\)/)).toBeTruthy();
  });

  it('código incompleto: Entrar deshabilitado', async () => {
    await render(<Login />);
    await goCodeStep();
    const code = screen.getByTestId('login-code-input');
    await fireEvent.changeText(code, '12345');
    const entrar = screen.getByRole('button', { name: 'Entrar' });
    expect(entrar.props.accessibilityState.disabled).toBe(true);
  });

  it('código completo + Entrar: verifica el correo y el código', async () => {
    await render(<Login />);
    await goCodeStep();
    const code = screen.getByTestId('login-code-input');
    await fireEvent.changeText(code, '123456');
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
    });
    expect(mockState.verifyEmailCode).toHaveBeenCalledWith('ana@vertice.app', '123456');
  });

  it('solo acepta dígitos en el código (máx. 6)', async () => {
    await render(<Login />);
    await goCodeStep();
    const code = screen.getByTestId('login-code-input');
    await fireEvent.changeText(code, '12ab34cd5678');
    expect(code.props.value).toBe('123456');
  });

  it('código malo: muestra el error literal de A4', async () => {
    setStore({
      verifyEmailCode: jest.fn().mockResolvedValue(false),
      error: 'otp_invalid',
    });
    await render(<Login />);
    await goCodeStep();
    const code = screen.getByTestId('login-code-input');
    await fireEvent.changeText(code, '123456');
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
    });
    expect(screen.getByTestId('login-error').props.children).toBe(AUTH_MESSAGES.otp_invalid);
  });

  it('error de red: traduce el código network al texto literal', async () => {
    setStore({
      sendEmailCode: jest.fn().mockResolvedValue(false),
      error: 'network',
    });
    await render(<Login />);
    const email = screen.getByTestId('login-email-input');
    await fireEvent.changeText(email, 'ana@vertice.app');
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Enviar código' }));
    });
    expect(screen.getByTestId('login-error').props.children).toBe(AUTH_MESSAGES.network);
  });

  it('Google fallo: traduce google_failed', async () => {
    setStore({
      signInWithGoogle: jest.fn().mockResolvedValue(undefined),
      error: 'google_failed',
    });
    await render(<Login />);
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Continuar con Google' }));
    });
    expect(mockState.signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('login-error').props.children).toBe(AUTH_MESSAGES.google_failed);
  });

  it('cargando: el botón con spinner no dispara de nuevo', async () => {
    let resolveSend: (v: boolean) => void = () => undefined;
    setStore({ sendEmailCode: jest.fn(() => new Promise((r) => (resolveSend = r))) });
    await render(<Login />);
    const email = screen.getByTestId('login-email-input');
    await fireEvent.changeText(email, 'ana@vertice.app');
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Enviar código' }));
    });
    const send = screen.getByRole('button', { name: 'Enviar código' });
    expect(send.props.accessibilityState.busy).toBe(true);
    await act(async () => {
      fireEvent.press(send);
    });
    expect(mockState.sendEmailCode).toHaveBeenCalledTimes(1);
    resolveSend(true);
    await act(async () => undefined);
  });

  it('cambiar correo: vuelve al paso de correo', async () => {
    await render(<Login />);
    await goCodeStep();
    await fireEvent.press(screen.getByRole('button', { name: 'Cambiar correo' }));
    expect(screen.queryByTestId('login-code-input')).toBeNull();
    expect(screen.getByTestId('login-email-input')).toBeTruthy();
  });

  it('pie: política, términos y marca VERTICE', async () => {
    await render(<Login />);
    expect(screen.getByText(/Política de privacidad/)).toBeTruthy();
    expect(screen.getByText(/Términos/)).toBeTruthy();
    expect(screen.getByText('Una app de VERTICE')).toBeTruthy();
  });
});
