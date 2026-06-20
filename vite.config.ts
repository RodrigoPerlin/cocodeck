import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";

export default defineConfig(async ({ command }) => {
  const plugins = [
    tailwindcss(),
    tsConfigPaths(),
    // Redireciona a entrada SSR do TanStack Start para src/server.ts.
    tanstackStart({ server: { entry: "server" } }),
  ];

  // Plugin de deploy (Nitro) só roda no build. Alvo Vercel por padrão;
  // sobreponha com a variável de ambiente NITRO_PRESET se precisar (ex: node-server).
  if (command === "build") {
    const { nitro } = await import("nitro/vite");
    plugins.push(nitro({ preset: process.env.NITRO_PRESET || "vercel" }));
  }

  plugins.push(viteReact());

  return {
    plugins,
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    server: {
      host: "::",
      port: 8080,
      // Esta máquina atingiu o limite de inotify (fs.inotify.max_user_watches),
      // então usamos polling no dev para não depender de file watchers do sistema.
      // Se você aumentar o limite (sudo sysctl fs.inotify.max_user_watches=524288),
      // pode remover este bloco para um HMR mais leve.
      watch: {
        usePolling: true,
        interval: 300,
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/.vercel/**",
          "**/dist/**",
          "**/.nitro/**",
          "**/.output/**",
          "**/.tanstack/**",
        ],
      },
    },
  };
});
