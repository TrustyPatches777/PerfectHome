import { KO_LABELS } from './ko-labels';
import { KO_UI } from './ko-ui';

/** The Korean dictionary: English text -> Korean text. Loaded only when Korean is switched on. */
export const KO: Record<string, string> = { ...KO_UI, ...KO_LABELS };
