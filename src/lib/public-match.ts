import type { Match } from './tennis';

export function publicMatch(match: Match, access: string | null = null): Match {
  const {
    codeHash,
    savedCode,
    currentCode,
    refereeCodeHash,
    refereeSavedCode,
    refereeCurrentCode,
    refereeToken,
    history,
    canUndo,
    ...data
  } = match as Match & { history?: unknown; canUndo?: unknown };
  return {
    ...data,
    ...(access === 'admin' && savedCode ? { currentCode: savedCode } : {}),
    ...(access === 'admin' && data.refereeEnabled && refereeSavedCode
      ? { refereeCurrentCode: refereeSavedCode }
      : {}),
    needsCodeUpgrade: !!codeHash && data.codeFormat !== 'pin5',
  };
}
