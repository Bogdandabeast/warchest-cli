export type ClientMode = "title" | "draft" | "menu" | "targeting" | "victory";

export const KEY_BINDINGS: Readonly<Record<ClientMode, Readonly<Record<string, string>>>> = {
  title: { return: "start", q: "quit" },
  draft: { left: "previous-card", right: "next-card", return: "pick-card" },
  // Esc en el menú vuelve a elegir moneda (`back`, como en señalar) SIN
  // pasar/descartar: pasar exige confirmación explícita con la acción Pasar.
  menu: { up: "previous-action", down: "next-action", return: "execute-action", escape: "back", l: "log", d: "deploy", r: "bolster", m: "move", a: "attack", c: "control", h: "ability", i: "initiative", p: "recruit" },
  targeting: { up: "cursor-up", down: "cursor-down", left: "cursor-left", right: "cursor-right", w: "cursor-up", s: "cursor-down", a: "cursor-left", d: "cursor-right", return: "confirm-target", escape: "back", tab: "next-step" },
  victory: { return: "restart", q: "quit" },
};
