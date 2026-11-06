import {
  AudioLines,
  BookOpenText,
  Camera,
  Feather,
  FileText,
  Layers3,
  Mail,
  Palette,
  Quote,
  type LucideIcon,
} from 'lucide-react';

import type { PieceMedium, PieceType } from '@/lib/api';

export type FeedCategoryId =
  | 'all'
  | 'poem'
  | 'story'
  | 'essay'
  | 'letter'
  | 'fragment'
  | 'photography'
  | 'artwork'
  | 'audio';

export type FeedCategory = {
  id: FeedCategoryId;
  label: string;
  icon: LucideIcon;
  type?: PieceType;
  medium?: PieceMedium;
};

export const feedCategories: readonly FeedCategory[] = [
  { id: 'all', label: 'All pages', icon: Layers3 },
  { id: 'poem', label: 'Poems', icon: Feather, type: 'poem' },
  { id: 'story', label: 'Short stories', icon: BookOpenText, type: 'story' },
  { id: 'essay', label: 'Essays', icon: FileText, type: 'essay' },
  { id: 'letter', label: 'Letters', icon: Mail, type: 'letter' },
  { id: 'fragment', label: 'Fragments', icon: Quote, type: 'fragment' },
  { id: 'photography', label: 'Photography', icon: Camera, medium: 'photography' },
  { id: 'artwork', label: 'Artwork', icon: Palette, medium: 'artwork' },
  { id: 'audio', label: 'Audio', icon: AudioLines, medium: 'audio' },
];

export function feedCategory(id: FeedCategoryId) {
  return feedCategories.find((category) => category.id === id) ?? feedCategories[0];
}
