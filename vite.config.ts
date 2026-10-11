import { defineConfig, loadEnv } from "vite";
import { publicRelayOrigin } from "./scripts/relay-env.ts";

export default defineConfig(({ mode }) => ({
  define: {
    "import.meta.env.VITE_PLEXON_RELAY_URL": JSON.stringify(
      publicRelayOrigin(loadEnv(mode, process.cwd(), ["VITE_PLEXON_RELAY_URL", "NEXT_PUBLIC_PLEXON_RELAY_URL"])),
    ),
    ...(mode === "verification" || process.env.PLEXON_VISUAL_QA === "1"
      ? { "import.meta.env.DEV": "true" }
      : {}),
  },
  server: { host: "127.0.0.1", port: 4173, allowedHosts: ["terminal.local"] },
  build: { outDir: "dist", sourcemap: false, target: "es2022" },
}));
