import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    
  ]),
    {
    files: ["src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["**/lib/prisma", "**/lib/data/insights"],
          message: "Akses data hanya lewat src/lib/data/admin atau public.",
        }],
      }],
    },
  },
  {
    files: ["src/app/(public)/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["**/lib/prisma", "**/lib/data/insights", "**/lib/data/admin"],
          message: "Kode publik dan komponen tidak boleh mengimpor akses data admin.",
        }],
      }],
    },
  },
]);

export default eslintConfig;
