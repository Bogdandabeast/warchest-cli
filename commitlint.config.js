// @ts-check
/**
 * Configuración de commitlint: mensajes de commit convencionales
 * (https://www.conventionalcommits.org/). El hook .husky/commit-msg lo
 * aplica en cada commit y falla si el mensaje no cumple el formato.
 */
/** @type {import("@commitlint/types").UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Tipos permitidos por config-conventional + `chore`, que ya incluye.
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore", "revert"],
    ],
    // El asunto no debe superar 100 caracteres.
    "header-max-length": [2, "always", 100],
    // Siempre en minúsculas al inicio (evita "Feat: ...").
    "subject-case": [2, "always", ["lower-case"]],
  },
};
