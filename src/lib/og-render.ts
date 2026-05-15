// Build-time OG-card renderer. Composes a Satori element tree from a
// CardSpec, hands it to Satori for SVG generation, then rasterizes the
// SVG to PNG with @resvg/resvg-js (Node-native, fast).
//
// Pure to-the-input function. Called by scripts/og-cards/build.ts;
// not imported by the Cloudflare worker runtime.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

// Palette mirrors src/styles/global.css so cards feel like the site.
const PALETTE = {
  night:     '#0B0826',
  paper:     '#EDE0B4',
  ink:       '#F1E7C8',
  inkDeep:   '#08071A',
  gold:      '#D4A93C',
  goldSoft:  '#E8C56B',
  goldDim:   '#8A6B2A',
  amaranth:  '#B73A5E',
} as const;

const FONT_DIR = path.resolve(
  './node_modules/@fontsource/cinzel/files',
);

const FONTS = [
  {
    name: 'Cinzel',
    data: readFileSync(path.join(FONT_DIR, 'cinzel-latin-400-normal.woff')),
    weight: 400 as const,
    style: 'normal' as const,
  },
  {
    name: 'Cinzel',
    data: readFileSync(path.join(FONT_DIR, 'cinzel-latin-900-normal.woff')),
    weight: 900 as const,
    style: 'normal' as const,
  },
];

export interface CardSpec {
  /** Big centred text — the number, word, or page title. */
  hero: string;
  /** Small uppercase line at the top-right; tier or system. */
  kicker?: string;
  /** One-line description under the hero. */
  caption?: string;
  /** Bottom-right tag — e.g. "Root 7 · the mystic". */
  badge?: string;
  /** "paper" inverts the dark theme to the parchment palette. */
  variant?: 'dark' | 'paper';
}

export async function renderOgCard(spec: CardSpec): Promise<Buffer> {
  const svg = await satori(buildTree(spec) as Parameters<typeof satori>[0], {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: FONTS,
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: OG_WIDTH },
    background: spec.variant === 'paper' ? PALETTE.paper : PALETTE.night,
  });
  return resvg.render().asPng();
}

// Hero font size scales with character count so long words/numbers
// don't bust the frame.
function heroSize(hero: string): number {
  const len = hero.length;
  if (len <= 3) return 320;
  if (len <= 5) return 240;
  if (len <= 8) return 180;
  if (len <= 12) return 130;
  if (len <= 18) return 96;
  return 72;
}

function buildTree(spec: CardSpec): unknown {
  const dark = spec.variant !== 'paper';
  const bg = dark ? PALETTE.night : PALETTE.paper;
  const ink = dark ? PALETTE.ink : PALETTE.inkDeep;
  const gold = dark ? PALETTE.gold : PALETTE.goldDim;
  const goldFaint = dark ? PALETTE.goldDim : PALETTE.gold;

  const topRowKids: unknown[] = [
    {
      type: 'div',
      props: {
        style: {
          fontSize: 28,
          fontWeight: 900,
          letterSpacing: 12,
          color: gold,
        },
        children: 'NUMLORE',
      },
    },
  ];
  if (spec.kicker) {
    topRowKids.push({
      type: 'div',
      props: {
        style: {
          fontSize: 22,
          fontWeight: 400,
          letterSpacing: 8,
          color: PALETTE.amaranth,
          textTransform: 'uppercase',
        },
        children: spec.kicker,
      },
    });
  }

  const centerKids: unknown[] = [
    {
      type: 'div',
      props: {
        style: {
          fontSize: heroSize(spec.hero),
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: '-0.02em',
          color: ink,
          textAlign: 'center',
          display: 'flex',
        },
        children: spec.hero,
      },
    },
  ];
  if (spec.caption) {
    centerKids.push({
      type: 'div',
      props: {
        style: {
          fontSize: 30,
          fontWeight: 400,
          lineHeight: 1.3,
          color: ink,
          opacity: 0.78,
          marginTop: 28,
          maxWidth: 980,
          textAlign: 'center',
          display: 'flex',
        },
        children: spec.caption,
      },
    });
  }

  const bottomKids: unknown[] = [];
  bottomKids.push({
    type: 'div',
    props: {
      style: {
        fontSize: 20,
        letterSpacing: 6,
        color: goldFaint,
        textTransform: 'uppercase',
      },
      children: 'numlore.com',
    },
  });
  if (spec.badge) {
    bottomKids.push({
      type: 'div',
      props: {
        style: {
          fontSize: 22,
          letterSpacing: 5,
          color: gold,
          textTransform: 'uppercase',
        },
        children: spec.badge,
      },
    });
  }

  return {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px 96px',
        background: bg,
        fontFamily: 'Cinzel',
      },
      children: [
        {
          type: 'div',
          props: {
            style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
            children: topRowKids,
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
            },
            children: centerKids,
          },
        },
        {
          type: 'div',
          props: {
            style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
            children: bottomKids,
          },
        },
      ],
    },
  };
}
