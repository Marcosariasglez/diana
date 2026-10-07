import { hash32 } from './hash';

const PALETTE = [
  '#1F2A44', '#5B3A8C', '#B8860B', '#0F4D3A', '#7A2E3A', '#2E5E7A',
  '#4A4A52', '#8A4B1F', '#2F6B5E', '#6B3F5E', '#3A3F8F', '#7A6A1E',
];

export function posterColor(mediaId: number): string {
  return PALETTE[hash32(`poster-${mediaId}`) % PALETTE.length];
}