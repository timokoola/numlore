// JSON-LD schema generators. Pure functions; no I/O. Composed per page
// and rendered as separate <script type="application/ld+json"> blocks in
// the page <head> by src/components/JsonLd.astro.
//
// Sitewide knowledge-graph anchors (referenced via @id from every page):
//   https://numlore.com/#website     — WebSite
//   https://numlore.com/#publisher   — Organization
//   https://numlore.com/#dictionary  — DefinedTermSet (the whole corpus)
//
// Per-system DefinedTermSet @ids:
//   https://numlore.com/systems/major#set
//   https://numlore.com/systems/keypad#set
//   https://numlore.com/systems/leet#set
//   https://numlore.com/systems/cultural#set

const SITE = 'https://numlore.com';

export const SCHEMA_IDS = {
  website: `${SITE}/#website`,
  publisher: `${SITE}/#publisher`,
  dictionary: `${SITE}/#dictionary`,
} as const;

function abs(path: string): string {
  return new URL(path, SITE).toString();
}

// ───── Sitewide entities (every page) ────────────────────────────────────

export function siteEntities(): unknown[] {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': SCHEMA_IDS.website,
      url: SITE + '/',
      name: 'Numlore',
      description: 'A bidirectional number↔word mnemonic dictionary.',
      inLanguage: 'en',
      publisher: { '@id': SCHEMA_IDS.publisher },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': SCHEMA_IDS.publisher,
      name: 'Numlore',
      url: SITE + '/',
      parentOrganization: {
        '@type': 'Organization',
        name: 'Skadi Oy',
        address: { '@type': 'PostalAddress', addressLocality: 'Helsinki', addressCountry: 'FI' },
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'DefinedTermSet',
      '@id': SCHEMA_IDS.dictionary,
      name: 'Numlore dictionary',
      description: 'Curated and algorithmic mnemonic mappings between numbers and words.',
      url: SITE + '/',
      inLanguage: 'en',
      publisher: { '@id': SCHEMA_IDS.publisher },
    },
  ];
}

// ───── Per-page entities ─────────────────────────────────────────────────

interface WebPageArgs {
  path: string;
  name: string;
  description: string;
}

export function webPageSchema({ path, name, description }: WebPageArgs): unknown {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': abs(path) + '#webpage',
    url: abs(path),
    name,
    description,
    inLanguage: 'en',
    isPartOf: { '@id': SCHEMA_IDS.website },
  };
}

interface CollectionPageArgs {
  path: string;
  name: string;
  description: string;
  items: Array<{ name: string; path: string }>;
}

export function collectionPageSchema({ path, name, description, items }: CollectionPageArgs): unknown {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': abs(path) + '#webpage',
    url: abs(path),
    name,
    description,
    inLanguage: 'en',
    isPartOf: { '@id': SCHEMA_IDS.website },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.name,
        url: abs(item.path),
      })),
    },
  };
}

export function breadcrumbSchema(items: Array<{ name: string; path: string }>): unknown {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: abs(item.path),
    })),
  };
}

interface DefinedTermArgs {
  path: string;
  name: string;
  description: string;
  termCode?: string;
  inDefinedTermSet?: string; // @id of the set; defaults to #dictionary
}

export function definedTermSchema({
  path,
  name,
  description,
  termCode,
  inDefinedTermSet,
}: DefinedTermArgs): unknown {
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    '@id': abs(path) + '#term',
    url: abs(path),
    name,
    description,
    inLanguage: 'en',
    ...(termCode && { termCode }),
    inDefinedTermSet: { '@id': inDefinedTermSet ?? SCHEMA_IDS.dictionary },
  };
}

interface DefinedTermSetArgs {
  path: string;
  setIdFragment: string; // e.g. "set" -> path#set
  name: string;
  description: string;
  terms?: Array<{ termCode: string; name: string; description?: string }>;
}

export function definedTermSetSchema({
  path,
  setIdFragment,
  name,
  description,
  terms,
}: DefinedTermSetArgs): unknown {
  const setId = abs(path) + '#' + setIdFragment;
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    '@id': setId,
    url: abs(path),
    name,
    description,
    inLanguage: 'en',
    isPartOf: { '@id': SCHEMA_IDS.website },
    publisher: { '@id': SCHEMA_IDS.publisher },
  };
  if (terms && terms.length > 0) {
    schema.hasDefinedTerm = terms.map((t) => ({
      '@type': 'DefinedTerm',
      termCode: t.termCode,
      name: t.name,
      ...(t.description && { description: t.description }),
      inDefinedTermSet: { '@id': setId },
    }));
  }
  return schema;
}
