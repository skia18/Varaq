/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Oklch = readonly [lightness: number, chroma: number, hue: number];

const MINIMUM_TEXT_CONTRAST = 4.5;
const source = readFileSync(new URL('./colors.css', import.meta.url), 'utf8');

const contrastContract = [
  ['foreground', 'background'],
  ['foreground', 'card'],
  ['foreground', 'secondary'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['muted-foreground', 'muted'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'card'],
  ['accent-foreground', 'accent'],
  ['primary', 'background'],
  ['primary', 'card'],
  ['primary', 'secondary'],
  ['destructive', 'background'],
  ['destructive', 'card'],
  ['faded', 'background'],
  ['faded', 'card'],
  ['sidebar-foreground', 'sidebar'],
  ['sidebar-primary-foreground', 'sidebar-primary'],
  ['sidebar-accent-foreground', 'sidebar-accent'],
] as const;

const postItContract = [
  'postit-paper',
  'postit-sage',
  'postit-blue',
  'postit-blush',
  'postit-ochre',
  'postit-red',
] as const;

function declarations(selector: ':root' | '.dark') {
  const escapedSelector = selector.replace('.', '\\.');
  const block = source.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`))?.[1];

  if (!block) throw new Error(`Could not find the ${selector} colour tokens`);

  return new Map(
    [...block.matchAll(/--([\w-]+):\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\);/g)].map(
      ([, name, lightness, chroma, hue]) => [
        name,
        [Number(lightness), Number(chroma), Number(hue)] as Oklch,
      ],
    ),
  );
}

function relativeLuminance([lightness, chroma, hue]: Oklch) {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (channel: number) => Math.max(0, Math.min(1, channel));
  const red = clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const green = clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const blue = clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: Oklch, background: Oklch) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

describe.each([
  ['light', ':root'],
  ['dark', '.dark'],
] as const)('%s colour contract', (_, selector) => {
  const tokens = declarations(selector);

  it.each(contrastContract)('%s on %s is at least 4.5:1', (foreground, background) => {
    const foregroundValue = tokens.get(foreground);
    const backgroundValue = tokens.get(background);

    expect(foregroundValue, `Missing --${foreground} in ${selector}`).toBeDefined();
    expect(backgroundValue, `Missing --${background} in ${selector}`).toBeDefined();
    expect(contrast(foregroundValue!, backgroundValue!)).toBeGreaterThanOrEqual(
      MINIMUM_TEXT_CONTRAST,
    );
  });
});

describe('rustic post-it colour contract', () => {
  const tokens = declarations(':root');

  it.each(postItContract)('postit-ink on %s is at least 4.5:1', (background) => {
    const ink = tokens.get('postit-ink');
    const backgroundValue = tokens.get(background);

    expect(ink, 'Missing --postit-ink in :root').toBeDefined();
    expect(backgroundValue, `Missing --${background} in :root`).toBeDefined();
    expect(contrast(ink!, backgroundValue!)).toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
  });
});
