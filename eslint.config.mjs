import baseConfig from "./packages/config/eslint/base.mjs";

export default [
  ...baseConfig,
  {
    ignores: ["**/postcss.config.mjs"]
  },
  {
    files: ["apps/web/lib/server/store.memory.ts"],
    rules: {
      "@typescript-eslint/require-await": "off"
    }
  },
  {
    files: ["apps/web/lib/server/store.postgres.ts"],
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off"
    }
  }
];
