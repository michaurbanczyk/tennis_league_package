'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import type { Board, Level } from '@/lib/tennis';

export function BracketPdfButton({
  level,
  board,
  archiveId,
  isDemo,
}: {
  level: Level;
  board: Board;
  archiveId?: string;
  isDemo: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function download() {
    if (busy) return;
    setBusy(true);
    try {
      let currentBoard = board;
      let currentLevel = level;
      if (!isDemo) {
        const url = archiveId
          ? `/api/league?archive=${encodeURIComponent(archiveId)}`
          : '/api/league';
        const response = await fetch(url, {
          cache: 'no-store',
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw Error('Nie udało się pobrać aktualnej drabinki.');
        currentBoard = (await response.json()) as Board;
        currentLevel = currentBoard.levels.find((item) => item.id === level.id)!;
        if (!currentLevel) throw Error('Ten poziom nie jest już dostępny.');
      }

      const [{ createBracketPdf, pdfFileName }, fontResponse, boldFontResponse, logoResponse] =
        await Promise.all([
          import('@/lib/bracket-pdf'),
          fetch('/fonts/manrope/Manrope-Medium.ttf'),
          fetch('/fonts/manrope/Manrope-Bold.ttf'),
          fetch('/relaksmisja-logo.jpeg'),
        ]);
      if (!fontResponse.ok || !boldFontResponse.ok || !logoResponse.ok)
        throw Error('Nie udało się wczytać zasobów PDF.');
      const bytes = await createBracketPdf({
        board: currentBoard,
        level: currentLevel,
        fontBytes: new Uint8Array(await fontResponse.arrayBuffer()),
        boldFontBytes: new Uint8Array(await boldFontResponse.arrayBuffer()),
        logoBytes: new Uint8Array(await logoResponse.arrayBuffer()),
      });
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = pdfFileName(currentBoard.season, currentLevel.name);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 60000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się przygotować pliku PDF.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="bracket-pdf-button" onClick={download} disabled={busy}>
      <Download size={14} aria-hidden="true" />
      {busy ? 'Przygotowywanie PDF…' : 'Pobierz drabinkę PDF'}
    </button>
  );
}
