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
      // /projetos apenas redireciona para /#projetos — fora do sitemap
      filter: (page) => !page.endsWith('/projetos/'),
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
