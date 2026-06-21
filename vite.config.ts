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
    plugins.push(
      nitro({
        preset: process.env.NITRO_PRESET || "vercel",
        rollupConfig: {
          output: {
            // O driver mongodb usa require() para módulos nativos opcionais. No
            // bundle ESM da Vercel `require` não existe -> "require is not defined".
            // Recriamos require via createRequire para que essas chamadas resolvam
            // em runtime no Node (idempotente, não colide com o __require do Nitro).
            banner:
              'import{createRequire as __cocodeckCreateRequire}from"node:module";if(typeof globalThis.require==="undefined"){globalThis.require=__cocodeckCreateRequire(import.meta.url);}',
          },
        },
      }),
    );
  }

  plugins.push(viteReact());

  // Dependências nativas opcionais do driver mongodb. Empacotá-las quebra o
  // build (módulos .node) e o runtime ESM. Como são opcionais, externalizá-las
  // faz o driver funcionar sem elas; o Nitro as inclui na função quando existem.
  const mongoNativeOptionalDeps = [
    "mongodb-client-encryption",
    "kerberos",
    "@mongodb-js/zstd",
    "snappy",
    "aws4",
    "gcp-metadata",
    "socks",
    "@aws-sdk/credential-providers",
  ];

  return {
    plugins,
    ssr: {
      external: mongoNativeOptionalDeps,
    },
    optimizeDeps: {
      exclude: mongoNativeOptionalDeps,
    },
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
