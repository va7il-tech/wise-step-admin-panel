import { Circle, Diamond, Hexagon, Square, Star, Triangle, type LucideIcon } from 'lucide-react';

/**
 * Kahoot-style option identities: on phones players tap by color + shape,
 * which must match what the big screen shows.
 */
export interface OptionStyle {
  bg: string;
  icon: LucideIcon;
}

export const OPTION_STYLES: OptionStyle[] = [
  { bg: 'bg-[#E5484D]', icon: Triangle },
  { bg: 'bg-[#3E63DD]', icon: Diamond },
  { bg: 'bg-[#F2B705]', icon: Circle },
  { bg: 'bg-[#01B5B4]', icon: Square },
  { bg: 'bg-[#8E4EC6]', icon: Star },
  { bg: 'bg-[#2F9E68]', icon: Hexagon },
];

export function optionStyle(index: number): OptionStyle {
  return OPTION_STYLES[index % OPTION_STYLES.length] ?? OPTION_STYLES[0]!;
}
