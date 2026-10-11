// ──────────────────────────────────────────────────────────────────────────────
// apps/site — Authoritative Brand Asset Entrypoint
//
// All brand assets MUST be accessed via this module.
// Direct imports of image files across components are forbidden.
// ──────────────────────────────────────────────────────────────────────────────

import type { ImageMetadata } from 'astro';

import logoWebp from './assets/brand/logo.webp';
import logoPng from './assets/brand/logo.png';
import mascotWebp from './assets/brand/mascot.webp';
import mascotPng from './assets/brand/mascot.png';
import notFoundWebp from './assets/brand/404.webp';
import notFoundPng from './assets/brand/404.png';
import bannerWebp from './assets/brand/banner.webp';
import bannerPng from './assets/brand/banner.png';

export type MascotPlacement = 'hero' | 'section' | 'cta' | 'footer' | '404';

export interface BrandAssetDescriptor {
  readonly src: ImageMetadata;
  readonly fallbackSrc: ImageMetadata;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
}

export const brandAssets = {
  logo: {
    src: logoWebp,
    fallbackSrc: logoPng,
    width: 128,
    height: 128,
    alt: 'Reqnx home',
  },
  mascot: {
    src: mascotWebp,
    fallbackSrc: mascotPng,
    width: 480,
    height: 480,
    alt: '',
  },
  notFound: {
    src: notFoundWebp,
    fallbackSrc: notFoundPng,
    width: 560,
    height: 373,
    alt: '',
  },
  banner: {
    src: bannerWebp,
    fallbackSrc: bannerPng,
    width: 1200,
    height: 400,
    alt: 'Reqnx banner',
  },
} as const satisfies Record<string, BrandAssetDescriptor>;

export interface MascotPlacementConfig {
  readonly width: number;
  readonly height: number;
  readonly sizes: string;
  readonly loading: 'eager' | 'lazy';
  readonly fetchpriority?: 'high' | 'auto' | 'low';
}

export const mascotPlacements: Record<MascotPlacement, MascotPlacementConfig> = {
  hero: {
    width: 260,
    height: 260,
    sizes: '(max-width: 768px) 180px, 260px',
    loading: 'lazy',
    fetchpriority: 'auto',
  },
  section: {
    width: 220,
    height: 220,
    sizes: '(max-width: 768px) 160px, 220px',
    loading: 'lazy',
    fetchpriority: 'low',
  },
  cta: {
    width: 300,
    height: 300,
    sizes: '(max-width: 768px) 200px, 300px',
    loading: 'lazy',
    fetchpriority: 'low',
  },
  footer: {
    width: 44,
    height: 44,
    sizes: '44px',
    loading: 'lazy',
    fetchpriority: 'low',
  },
  404: {
    width: 560,
    height: 373,
    sizes: '(max-width: 768px) 320px, 560px',
    loading: 'eager',
    fetchpriority: 'high',
  },
};
