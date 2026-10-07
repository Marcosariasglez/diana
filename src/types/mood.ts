import type { LucideIcon } from 'lucide-react-native';
import type { MediaType } from './media';

export type Complexity = 'express' | 'intermedio' | 'cinefilo';
export type MoodQuestionId = 'time' | 'energy' | 'company' | 'era' | 'pace' | 'platforms';

export type MoodEffect =
  | { kind: 'runtime'; minMinutes?: number; maxMinutes?: number }
  | { kind: 'mediaType'; mediaType: MediaType }
  | { kind: 'era'; fromYear?: number; toYear?: number }
  | { kind: 'platform'; platformId: string }
  | { kind: 'genres'; boost: number[] }
  | { kind: 'none' };

export interface MoodAnswerOption {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  effect: MoodEffect;
}

export interface MoodQuestion {
  id: MoodQuestionId;
  title: string;
  selection: 'single' | 'multiple';
  options: MoodAnswerOption[];
}

export interface MoodFilters {
  answers: Record<string, string>;
  fallbackPlatforms: string[];
}