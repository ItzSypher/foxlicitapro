import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./", import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  test: {
    environment: "node",
    projects: [
      {
        resolve: { alias },
        test: { name: "unidade", environment: "node", include: ["core/**/*.test.ts", "lib/**/*.test.ts"] },
      },
      {
        // Testes que usam o banco real: um arquivo por vez, para não lotar o pooler em modo sessão (15 conexões).
        resolve: { alias },
        test: { name: "banco", environment: "node", include: ["db/**/*.test.ts"], fileParallelism: false },
      },
    ],
  },
});
