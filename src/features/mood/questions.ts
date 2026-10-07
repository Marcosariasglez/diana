import {
  Calendar,
  Clock,
  Coffee,
  Film,
  Gauge,
  Heart,
  History,
  Hourglass,
  House,
  Moon,
  Shuffle,
  Sofa,
  Sparkles,
  Tv,
  User,
  Users,
  Zap,
} from 'lucide-react-native';
import { PLATFORMS } from '@/constants/platforms';
import type { Complexity, MoodQuestion, MoodQuestionId } from '@/types/mood';

export const QUESTIONS: Record<MoodQuestionId, MoodQuestion> = {
  time: {
    id: 'time',
    title: '¿Cuánto tiempo tienes?',
    selection: 'single',
    options: [
      {
        id: 'lt90',
        title: 'Menos de 90 min',
        subtitle: 'Algo ligero',
        icon: Clock,
        effect: { kind: 'runtime', maxMinutes: 90 },
      },
      {
        id: 'h2',
        title: 'Unas 2 horas',
        subtitle: 'Plan normal',
        icon: Film,
        effect: { kind: 'runtime', minMinutes: 90, maxMinutes: 150 },
      },
      {
        id: 'marathon',
        title: 'Maratón',
        subtitle: 'Sin prisa',
        icon: Sofa,
        effect: { kind: 'runtime', minMinutes: 150 },
      },
      {
        id: 'series',
        title: 'Una serie',
        subtitle: 'Capítulos sueltos',
        icon: Tv,
        effect: { kind: 'mediaType', mediaType: 'tv' },
      },
    ],
  },
  energy: {
    id: 'energy',
    title: '¿Qué energía tienes hoy?',
    selection: 'single',
    options: [
      {
        id: 'calm',
        title: 'Tranquila',
        subtitle: 'Para desconectar',
        icon: Moon,
        effect: { kind: 'genres', boost: [18, 10749, 99] },
      },
      {
        id: 'balanced',
        title: 'Equilibrada',
        subtitle: 'De todo un poco',
        icon: Coffee,
        effect: { kind: 'none' },
      },
      {
        id: 'intense',
        title: 'Intensa',
        subtitle: 'Con adrenalina',
        icon: Zap,
        effect: { kind: 'genres', boost: [28, 53, 27] },
      },
      {
        id: 'surprise',
        title: 'Sorpréndeme',
        subtitle: 'Sin pistas',
        icon: Sparkles,
        effect: { kind: 'none' },
      },
    ],
  },
  company: {
    id: 'company',
    title: '¿Con quién lo vas a ver?',
    selection: 'single',
    options: [
      { id: 'solo', title: 'Solo', subtitle: 'A mi aire', icon: User, effect: { kind: 'none' } },
      {
        id: 'couple',
        title: 'En pareja',
        subtitle: 'Plan a dos',
        icon: Heart,
        effect: { kind: 'genres', boost: [10749, 35] },
      },
      {
        id: 'friends',
        title: 'Con amigos',
        subtitle: 'Plan en grupo',
        icon: Users,
        effect: { kind: 'none' },
      },
      {
        id: 'family',
        title: 'En familia',
        subtitle: 'Para todos',
        icon: House,
        effect: { kind: 'genres', boost: [16, 10751] },
      },
    ],
  },
  era: {
    id: 'era',
    title: '¿De qué época?',
    selection: 'single',
    options: [
      {
        id: 'new',
        title: 'Reciente',
        subtitle: 'Desde 2020',
        icon: Calendar,
        effect: { kind: 'era', fromYear: 2020 },
      },
      {
        id: 'modern',
        title: 'Moderno',
        subtitle: '2000 a 2019',
        icon: Calendar,
        effect: { kind: 'era', fromYear: 2000, toYear: 2019 },
      },
      {
        id: 'classic',
        title: 'Clásico',
        subtitle: 'Antes de 2000',
        icon: History,
        effect: { kind: 'era', toYear: 1999 },
      },
      {
        id: 'any',
        title: 'Me da igual',
        subtitle: 'Cualquiera',
        icon: Shuffle,
        effect: { kind: 'none' },
      },
    ],
  },
  pace: {
    id: 'pace',
    title: '¿Qué ritmo prefieres?',
    selection: 'single',
    options: [
      {
        id: 'slow',
        title: 'Pausado',
        subtitle: 'Para saborear',
        icon: Hourglass,
        effect: { kind: 'genres', boost: [18, 99] },
      },
      {
        id: 'fast',
        title: 'Trepidante',
        subtitle: 'Sin respiro',
        icon: Gauge,
        effect: { kind: 'genres', boost: [28, 53] },
      },
      {
        id: 'any',
        title: 'Indiferente',
        subtitle: 'Cualquiera',
        icon: Shuffle,
        effect: { kind: 'none' },
      },
    ],
  },
  platforms: {
    id: 'platforms',
    title: '¿Dónde quieres verlo?',
    selection: 'multiple',
    options: PLATFORMS.map((p) => ({
      id: p.id,
      title: p.name,
      subtitle: 'Plataforma',
      icon: Tv,
      effect: { kind: 'platform' as const, platformId: p.id },
    })),
  },
};

export const QUESTIONS_BY_COMPLEXITY: Record<Complexity, MoodQuestionId[]> = {
  express: ['time', 'energy'],
  intermedio: ['time', 'energy', 'company', 'platforms'],
  cinefilo: ['time', 'energy', 'company', 'era', 'pace', 'platforms'],
};

export function getQuestionsFor(c: Complexity): MoodQuestion[] {
  return QUESTIONS_BY_COMPLEXITY[c].map((id) => QUESTIONS[id]);
}
