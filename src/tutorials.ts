interface BaseHelpResource {
  id: string;
  title: string;
  description: string;
}

export interface TutorialItem extends BaseHelpResource {
  kind: 'video';
  url?: string;
  embedUrl?: string;
  duration?: string;
}

export interface DocumentResource extends BaseHelpResource {
  kind: 'document';
  url?: string;
  format?: string;
}

export type HelpResource = TutorialItem | DocumentResource;

function youtubeEmbedUrl(videoId: string) {
  return `https://www.youtube.com/embed/${videoId}?rel=0&playsinline=1`;
}

// Provider-agnostic help resources. A future video adapter can populate
// embedUrl/url from Mux, YouTube, self-hosted files, or another provider;
// document resources can use url for downloadable PDFs, workbooks, or guides.
export const HELP_RESOURCES: HelpResource[] = [
  {
    kind: 'video',
    id: 'unfair-advantage',
    title: 'The Unfair Advantage',
    description: 'Watch the introductory Beyond Bullet Points tutorial in the floating canvas player.',
    url: 'https://www.youtube.com/watch?v=eGatAnh3O24',
    embedUrl: youtubeEmbedUrl('eGatAnh3O24'),
  },
  {
    kind: 'document',
    id: 'bbp-worksheet',
    title: 'BBP Worksheet',
    description: 'Downloadable workbook placeholder for future workshop handouts.',
    format: 'PDF',
  },
];

export const TUTORIALS = HELP_RESOURCES.filter(
  (resource): resource is TutorialItem => resource.kind === 'video'
);
