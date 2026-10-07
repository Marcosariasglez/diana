import { fireEvent, render, screen } from '@testing-library/react-native';
import { getQuestionsFor } from '@/features/mood/questions';
import { GroupMoodView } from './GroupMoodView';

const questions = getQuestionsFor('intermedio');
const base = {
  questions,
  answers: {} as Record<string, string>,
  moodComplete: false,
  onSelect: jest.fn(),
  onConfirm: jest.fn(),
  onBack: jest.fn(),
};

describe('Mood de grupo (vista)', () => {
  it('anfitrion: 4 preguntas, confirmar deshabilitado hasta moodComplete', async () => {
    const onConfirm = jest.fn();
    const onSelect = jest.fn();
    const { rerender } = await render(<GroupMoodView {...base} isHost onConfirm={onConfirm} onSelect={onSelect} />);
    expect(screen.getByText('PREGUNTA 1 DE 4')).toBeTruthy();
    expect(screen.getByText('PREGUNTA 4 DE 4')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Maratón. Sin prisa'));
    expect(onSelect).toHaveBeenCalledWith('time', 'marathon');
    await fireEvent.press(screen.getByLabelText('Confirmar filtros'));
    expect(onConfirm).not.toHaveBeenCalled();
    await rerender(<GroupMoodView {...base} isHost moodComplete onConfirm={onConfirm} onSelect={onSelect} />);
    await fireEvent.press(screen.getByLabelText('Confirmar filtros'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('invitado: respuestas como chips, "Esperando..." y texto fijo', async () => {
    await render(<GroupMoodView {...base} isHost={false} answers={{ time: 'lt90' }} />);
    expect(screen.getByText('Menos de 90 min')).toBeTruthy();
    expect(screen.getAllByText('Esperando...')).toHaveLength(3);
    expect(screen.getByText('El anfitrión está eligiendo los filtros')).toBeTruthy();
    expect(screen.queryByLabelText('Confirmar filtros')).toBeNull();
  });
});
