// @ts-check
/**
 * Configuración de ESLint 10 (flat config) para warchest-ai-cli.
 *
 * - **Solo archivos JS/MJS/CJS** (config del proyecto y scripts): ESLint no
 *   tiene parser nativo de TypeScript (ver discusión eslint/eslint#18830) y
 *   typescript-eslint fue retirado del toolchain. El código `.ts` se valida
 *   con `tsc --noEmit` (TypeScript 7) y `bun test`; no hay lint de TS.
 * - Lint de código: `@eslint/js` (recomendado) + globals de Node.js.
 * - Formato: **ESLint Stylistic** (`@stylistic/eslint-plugin`). El preset
 *   `customize` genera reglas de formato estilo-Prettier (indent 2, comillas
 *   dobles, punto y coma, 1tbs, trailing commas) que ESLint aplica con
 *   `--fix`. Prettier fue desinstalado: ESLint es la única herramienta de
 *   lint+formato (para JS; en TS se formatea manualmente o con el editor).
 *
 * Más información:
 *   https://eslint.style/guide/config-presets
 *   https://eslint.style/guide/getting-started
 */
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import stylistic from "@stylistic/eslint-plugin";
import globals from "globals";

const stylisticConfig = stylistic.configs.customize({
  // Las opciones imitan la configuración de Prettier que tenía el proyecto:
  indent: 2, // tabWidth: 2
  quotes: "double", // singleQuote: false
  semi: true, // semi: true
  braceStyle: "1tbs",
  commaDangle: "always-multiline", // trailingComma: "all"
  arrowParens: true, // arrowParens: "always"
  quoteProps: "as-needed",
  jsx: true,
});

export default defineConfig([
  {
    name: "global-ignores",
    // Archivos generados o ajenos al código fuente: no se lintan.
    ignores: [
      "node_modules/**",
      "dist/**",
      "out/**",
      "coverage/**",
      "assets/**",
      "*.svg",
      "bun.lock",
      ".git/**",
    ],
  },
  {
    name: "js-recommended",
    files: ["**/*.{js,mjs,cjs}"],
    ...js.configs.recommended,
    languageOptions: {
      // Globals de Node.js para scripts y archivos de configuración (.mjs/.cjs).
      globals: { ...globals.node },
    },
  },
  {
    name: "stylistic-formatting",
    files: ["**/*.{js,mjs,cjs}"],
    ...stylisticConfig,
    rules: {
      ...stylisticConfig.rules,
      // Ancho de línea equivalente a printWidth: 110 de Prettier. Los regex
      // literales no se parten ni en Prettier.
      "@stylistic/max-len": [
        "error",
        {
          code: 110,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreComments: true,
          ignoreRegExpLiterals: true,
          tabWidth: 2,
        },
      ],
      // Final de línea LF (evita ruido en diffs en Windows).
      "@stylistic/linebreak-style": ["error", "unix"],
    },
  },
]);
