// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import netlify from '@astrojs/netlify';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://cordeirolima.net',
  integrations: [
    sitemap({
      // páginas de projeto ainda são placeholders (noindex) — fora do sitemap
      filter: (page) => !page.includes('/projetos'),
    }),
  ],
  adapter: netlify(),
  build: {
    // CSS total é pequeno: inline elimina as requisições que bloqueiam a renderização
    inlineStylesheets: 'always',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
