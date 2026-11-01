import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {ignores: [".next/**", "node_modules/**", "supabase/.temp/**"]},
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Node CommonJS tests/scripts use require by design; this is not an ESM error.
    files: ["**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    // These fixtures execute compiled modules; they are not Next.js route modules.
    files: ["tests/**/*.cjs", "lib/**/*.test.cjs"],
    rules: { "@next/next/no-assign-module-variable": "off" },
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      // Text punctuation and const style are reported without blocking deployment.
      "react/no-unescaped-entities": "warn",
      "prefer-const": "warn"
    }
  }
];

export default eslintConfig;
