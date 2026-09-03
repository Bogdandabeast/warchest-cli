export interface DraftLayout {
  columns: number;
  rows: number;
  cardWidth: number;
}

export function draftLayout(terminalWidth: number, cardCount: number): DraftLayout {
  const safeWidth = Number.isFinite(terminalWidth) && terminalWidth > 0 ? terminalWidth : 80;
  const columns = Math.max(1, Math.min(4, Math.floor(safeWidth / 19)));
  const rows = Math.max(1, Math.ceil(cardCount / columns));
  const cardWidth = Math.max(16, Math.floor(safeWidth / columns) - 1);
  return { columns, rows, cardWidth };
}
