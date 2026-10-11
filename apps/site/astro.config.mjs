import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import preact from '@astrojs/preact';

import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  site: 'https://zynorex.github.io',
  base,

  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  },

  integrations: [
    starlight({
      title: 'REQNX',
      description: 'Predictable rate limiting for Node.js',
      favicon: '/favicon.svg',
      disable404Route: true,
      head: [
        {
          tag: 'meta',
          attrs: { name: 'robots', content: 'noindex, nofollow' },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'preconnect',
            href: 'https://fonts.googleapis.com',
          },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'preconnect',
            href: 'https://fonts.gstatic.com',
            crossorigin: '',
          },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'stylesheet',
            href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap',
          },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'stylesheet',
            href: 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css',
          },
        },
      ],
      social: [
        {
          label: 'GitHub',
          href: 'https://github.com/zynorex/reqnx',
          icon: 'github',
        },
      ],
      sidebar: [
        { label: 'Home', link: '/' },
        { label: 'Getting Started', link: '/getting-started/' },
        {
          label: 'Algorithms',
          items: [
            { label: 'Overview', link: '/algorithms/' },
            { label: 'Fixed Window', link: '/algorithms/fixed-window/' },
          ],
        },
        { label: 'Playground', link: '/playground/' },
      ],
      customCss: ['./src/styles/global.css'],
    }),
    preact(),
  ],

  vite: {
    ssr: {
      noExternal: ['@reqnx/core'],
    },
  },
});
