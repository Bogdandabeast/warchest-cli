import { renderBoardTerminal } from "./src/scripts/render-board-terminal.ts";

// Punto de entrada del proyecto (spec §13): dibuja el tablero 1v1 en la
// terminal usando el board compuesto desde los tiles de terreno
// (assets/board/board-1v1.svg). El mismo render lo reutilizará el cliente
// TUI en ciclos posteriores.
renderBoardTerminal();