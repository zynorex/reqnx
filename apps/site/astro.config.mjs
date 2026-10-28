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
          tag: 'meta',
          attrs: { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        },
        {
          tag: 'meta',
          attrs: { name: 'format-detection', content: 'telephone=no' },
        },
        {
          tag: 'meta',
          attrs: { name: 'theme-color', media: '(prefers-color-scheme: light)', content: '#f8fafc' },
        },
        {
          tag: 'meta',
          attrs: { name: 'theme-color', media: '(prefers-color-scheme: dark)', content: '#0b0d13' },
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
        {
          label: 'Start',
          items: [
            { label: 'Overview', link: '/' },
            { label: 'Getting Started', link: '/getting-started/' },
          ],
        },
        {
          label: 'Algorithms',
          items: [
            { label: 'Overview & Comparison', link: '/algorithms/' },
            { label: 'Fixed Window', link: '/algorithms/fixed-window/' },
            { label: 'Fixed Window (Redis Port)', link: '/algorithms/fixed-window-redis-port/' },
            { label: 'Token Bucket', link: '/algorithms/token-bucket/' },
            { label: 'Token Bucket (Redis Port)', link: '/algorithms/token-bucket-redis-port/' },
          ],
        },
        {
          label: 'Design & Architecture',
          items: [
            { label: 'System Architecture', link: '/design/architecture/' },
            { label: 'Baseline Benchmarks', link: '/design/benchmarks/day-04/' },
            {
              label: 'Architecture Decision Records (ADRs)',
              collapsed: true,
              autogenerate: { directory: 'design/adr' },
            },
          ],
        },
        {
          label: 'Playground',
          items: [
            { label: 'Interactive Simulator', link: '/playground/' },
          ],
        },
      ],
      components: {
        Header: './src/components/chrome/StarlightHeader.astro',
        Footer: './src/components/chrome/StarlightFooter.astro',
      },
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
