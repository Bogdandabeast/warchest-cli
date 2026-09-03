import { COLORS } from "../theme.ts";

export function MessageView({ message, error = false }: { message: string; error?: boolean }) {
  return (
    <box style={{ border: true, borderColor: error ? COLORS.error : COLORS.border, height: 4, paddingLeft: 1, paddingRight: 1 }}>
      <text fg={error ? COLORS.error : COLORS.text}>{`» ${message || "Selecciona una acción."}`}</text>
    </box>
  );
}
