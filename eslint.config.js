// @ts-check
/**
 * Configuración de ESLint 9 (flat config) para warchest-ai-cli.
 *
 * - Lint de código: `@eslint/js` (recomendado) + `typescript-eslint`
 *   (recommended + strict + stylistic), con **type-aware linting**
 *   (`recommendedTypeChecked`) para las reglas que necesitan información de
 *   tipos del TypeScript.
 * - Formato (reemplazo de Prettier): **ESLint Stylistic**
 *   (`@stylistic/eslint-plugin`). El preset `customize` de ESLint Stylistic
 *   genera reglas de formato estilo-Prettier (indent 2, comillas dobles,
 *   punto y coma, 1tbs, trailing commas) que ESLint aplica con `--fix`.
 *   Prettier fue desinstalado: ESLint es la única herramienta de lint+formato.
 *
 * Más información:
 *   https://typescript-eslint.io/getting-started/
 *   https://eslint.style/guide/config-presets
 *   https://eslint.style/guide/getting-started
 */
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import stylistic from "@stylistic/eslint-plugin";
import tseslint from "typescript-eslint";

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
  },
  {
    name: "ts-recommended",
    files: ["**/*.{ts,mts,cts}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.strict,
      ...tseslint.configs.stylistic,
      // Reglas que requieren información de tipos (más lento, detecta bugs reales).
      ...tseslint.configs.recommendedTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Estilo de importaciones: types-only como `import type`.
      "@typescript-eslint/consistent-type-imports": "error",
      // En Bun/Node ESM los console.log en scripts de CLI son legítimos.
      "no-console": "off",
      // Convención del repo (ver DECISIONS.md): se usan `!` deliberadamente
      // sobre valores ya validados (con `noUncheckedIndexedAccess` activo la
      // alternativa `undefined` check haría el código menos legible).
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  {
    name: "stylistic-formatting",
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    ...stylisticConfig,
    rules: {
      ...stylisticConfig.rules,
      // Ancho de línea equivalente a printWidth: 110 de Prettier. Los regex
      // literales (p. ej. el parser de SVG) no se parten ni en Prettier.
      "@stylistic/max-len": ["error", { code: 110, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreComments: true, ignoreRegExpLiterals: true, tabWidth: 2 }],
      // Final de línea LF (evita ruido en diffs en Windows).
      "@stylistic/linebreak-style": ["error", "unix"],
    },
  },
]);
