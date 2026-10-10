import tseslint from "typescript-eslint";
export default tseslint.config(...tseslint.configs.recommended, {
  ignores: ["dist/**", "receiver/dist/**", "node_modules/**"],
});
