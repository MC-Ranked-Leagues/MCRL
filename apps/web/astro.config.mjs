import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import { fileURLToPath } from "node:url";

import sitemap from "@astrojs/sitemap";
import fumadocs from "@fumadocs/astro";

// https://astro.build/config
export default defineConfig({
  site: process.env.SITE_URL,
  // Astro 7 defaults to "jsx", which drops the whitespace between inline
  // elements on separate lines that our templates rely on.
  compressHTML: true,
  vite: {
    plugins: [
      tailwindcss(),
      {
        // Matches `public/_redirects`, which only applies on Cloudflare.
        name: "week-routes",
        configureServer(server) {
          server.middlewares.use((request, _response, next) => {
            request.url = request.url?.replace(
              /^\/week\/[^/?]+\/?(?=\?|$)/,
              "/week/"
            );
            next();
          });
        },
      },
    ],
    resolve: {
      alias: [
        {
          find: "@",
          replacement: fileURLToPath(new URL("./src", import.meta.url)),
        },
      ],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-dom/client"],
    },
  },
  integrations: [
    react(),
    fumadocs({
      collections: {
        // `lastModified` dates each page by its last commit.
        docs: { dir: "src/content/docs", lastModified: true },
      },
      components: "./src/components/docs/mdx.tsx",
    }),
    sitemap(),
  ],
});
