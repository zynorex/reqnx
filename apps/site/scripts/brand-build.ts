import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '../../..');
const brandDir = path.join(repoRoot, 'brand');
const siteDir = path.join(repoRoot, 'apps/site');
const publicDir = path.join(siteDir, 'public');
const assetsBrandDir = path.join(siteDir, 'src/assets/brand');

fs.mkdirSync(assetsBrandDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });

function getChecksum(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/** Build a multi-resolution ICO file from PNG buffers. */
function buildIco(pngBuffers: { size: number; buffer: Buffer }[]): Buffer {
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const entriesOffset = headerSize + count * dirEntrySize;

  let currentOffset = entriesOffset;
  const entries: Buffer[] = [];

  for (const { size, buffer } of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // colors
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(buffer.length, 8); // size
    entry.writeUInt32LE(currentOffset, 12); // offset
    entries.push(entry);
    currentOffset += buffer.length;
  }

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // ICO type
  header.writeUInt16LE(count, 4); // count

  return Buffer.concat([header, ...entries, ...pngBuffers.map((b) => b.buffer)]);
}

async function main() {
  console.log('Building brand derivatives...');

  const manifest: Record<
    string,
    {
      role: string;
      checksum: string;
      byteSize: number;
      width: number;
      height: number;
    }
  > = {};

  const files = ['logo.png', 'mascot.png', '404.png', 'favicon.png', 'banner.png'];
  const roles: Record<string, string> = {
    'logo.png': 'logo',
    'mascot.png': 'mascot',
    '404.png': '404',
    'favicon.png': 'favicon',
    'banner.png': 'banner',
  };

  for (const file of files) {
    const filePath = path.join(brandDir, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Master brand asset missing: ${filePath}`);
    }
    const buf = fs.readFileSync(filePath);
    const meta = await sharp(buf).metadata();
    manifest[file] = {
      role: roles[file] ?? 'unknown',
      checksum: getChecksum(buf),
      byteSize: buf.length,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
    };
  }

  fs.writeFileSync(
    path.join(brandDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf-8',
  );
  console.log('✓ brand/manifest.json generated.');

  // 1. Generate Favicon set in apps/site/public/
  const faviconBuf = fs.readFileSync(path.join(brandDir, 'favicon.png'));
  const fav16 = await sharp(faviconBuf).resize(16, 16).png().toBuffer();
  const fav32 = await sharp(faviconBuf).resize(32, 32).png().toBuffer();
  const fav48 = await sharp(faviconBuf).resize(48, 48).png().toBuffer();
  const fav180 = await sharp(faviconBuf).resize(180, 180).png().toBuffer();
  const fav192 = await sharp(faviconBuf).resize(192, 192).png().toBuffer();
  const fav512 = await sharp(faviconBuf).resize(512, 512).png().toBuffer();

  fs.writeFileSync(path.join(publicDir, 'favicon-16.png'), fav16);
  fs.writeFileSync(path.join(publicDir, 'favicon-32.png'), fav32);
  fs.writeFileSync(path.join(publicDir, 'favicon-48.png'), fav48);
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), fav180);
  fs.writeFileSync(path.join(publicDir, 'icon-192.png'), fav192);
  fs.writeFileSync(path.join(publicDir, 'icon-512.png'), fav512);

  const icoBuf = buildIco([
    { size: 16, buffer: fav16 },
    { size: 32, buffer: fav32 },
    { size: 48, buffer: fav48 },
  ]);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuf);
  console.log(`✓ favicon.ico created (${icoBuf.length} B).`);

  // Webmanifest
  const webManifest = {
    name: 'Reqnx Rate Limiter',
    short_name: 'Reqnx',
    description: 'Pluggable, distributed-ready rate limiter for Node.js and TypeScript.',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    theme_color: '#14ddfd',
    background_color: '#090a0f',
    display: 'standalone',
    start_url: '/',
    scope: '/',
  };
  fs.writeFileSync(
    path.join(publicDir, 'site.webmanifest'),
    JSON.stringify(webManifest, null, 2) + '\n',
    'utf-8',
  );
  console.log('✓ public/site.webmanifest generated.');

  // 2. Generate optimized image derivatives in apps/site/src/assets/brand/
  // Logo derivatives
  const logoBuf = fs.readFileSync(path.join(brandDir, 'logo.png'));
  for (const width of [64, 128, 256, 512]) {
    await sharp(logoBuf)
      .resize(width)
      .webp({ quality: 90 })
      .toFile(path.join(assetsBrandDir, `logo-${width}.webp`));
    await sharp(logoBuf)
      .resize(width)
      .png({ compressionLevel: 9 })
      .toFile(path.join(assetsBrandDir, `logo-${width}.png`));
  }
  await sharp(logoBuf)
    .resize(128)
    .webp({ quality: 90 })
    .toFile(path.join(assetsBrandDir, 'logo.webp'));
  await sharp(logoBuf)
    .resize(128)
    .png({ compressionLevel: 9 })
    .toFile(path.join(assetsBrandDir, 'logo.png'));

  // Mascot derivatives
  const mascotBuf = fs.readFileSync(path.join(brandDir, 'mascot.png'));
  for (const width of [160, 240, 360, 480, 720]) {
    await sharp(mascotBuf)
      .resize(width)
      .webp({ quality: 85 })
      .toFile(path.join(assetsBrandDir, `mascot-${width}.webp`));
    await sharp(mascotBuf)
      .resize(width)
      .png({ compressionLevel: 9 })
      .toFile(path.join(assetsBrandDir, `mascot-${width}.png`));
  }
  await sharp(mascotBuf)
    .resize(480)
    .webp({ quality: 85 })
    .toFile(path.join(assetsBrandDir, 'mascot.webp'));
  await sharp(mascotBuf)
    .resize(480)
    .png({ compressionLevel: 9 })
    .toFile(path.join(assetsBrandDir, 'mascot.png'));

  // 404 derivatives
  const notFoundBuf = fs.readFileSync(path.join(brandDir, '404.png'));
  for (const width of [400, 560, 840, 1120]) {
    await sharp(notFoundBuf)
      .resize(width)
      .webp({ quality: 85 })
      .toFile(path.join(assetsBrandDir, `404-${width}.webp`));
    await sharp(notFoundBuf)
      .resize(width)
      .png({ compressionLevel: 9 })
      .toFile(path.join(assetsBrandDir, `404-${width}.png`));
  }
  await sharp(notFoundBuf)
    .resize(560)
    .webp({ quality: 85 })
    .toFile(path.join(assetsBrandDir, '404.webp'));
  await sharp(notFoundBuf)
    .resize(560)
    .png({ compressionLevel: 9 })
    .toFile(path.join(assetsBrandDir, '404.png'));

  // Banner derivatives
  const bannerBuf = fs.readFileSync(path.join(brandDir, 'banner.png'));
  for (const width of [724, 1200]) {
    await sharp(bannerBuf)
      .resize(width)
      .webp({ quality: 85 })
      .toFile(path.join(assetsBrandDir, `banner-${width}.webp`));
  }
  await sharp(bannerBuf)
    .resize(1200)
    .webp({ quality: 85 })
    .toFile(path.join(assetsBrandDir, 'banner.webp'));
  await sharp(bannerBuf)
    .resize(1200)
    .png({ compressionLevel: 9 })
    .toFile(path.join(assetsBrandDir, 'banner.png'));

  console.log('✓ All brand asset derivatives generated successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
