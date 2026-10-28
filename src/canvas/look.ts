import { useMemo } from 'react';
import { lookOf, type Look } from '../planStyle';
import { useDesign } from '../store/design';

/** How the plan is drawn now (the design's plan style, turned into colors and options). */
export function useLook(): Look {
  const style = useDesign((s) => s.design.style);
  return useMemo(() => lookOf(style), [style]);
}
