import { COLORS } from "../theme.ts";

export function TargetingHint({ action }: { action: string }) {
  return <box style={{ border: true, borderColor: COLORS.accent, height: 3 }}><text fg={COLORS.accent}>{`SEÑALAR · ${action}`}</text><text>Flechas/WASD mover · Enter confirmar · Esc volver</text></box>;
}
