import { defineConfig } from "vite";

const repoName = "durands-character-creator";

export default defineConfig(({ command }) => ({
  base: command === "build" ? `/${repoName}/` : "/",
  server: {
    port: 5173,
    open: true,
  },
}));
