/**
 * Landing-page portraits — AI-generated, photorealistic creator faces used
 * ONLY on the public home page (hero strip, ranked-applicant mock,
 * testimonial avatars). They are illustrative, not real users.
 *
 * Files live in /public/images/creators/<key>.jpg and are produced by
 * scripts/generate-landing-portraits.py (OpenRouter image model). A key
 * listed here without a file on disk simply falls back to initials, so the
 * page never shows a broken image while the set is still being generated.
 */
export type PortraitKey = 'selam' | 'amara' | 'kofi' | 'leila' | 'ravi' | 'mei' | 'sofia' | 'jonas' | 'grace';

export const PORTRAITS: Record<PortraitKey, { alt: string }> = {
  selam: { alt: 'Young Ethiopian woman filming a story on her phone' },
  amara: { alt: 'Young Black woman with curly hair holding a phone' },
  kofi: { alt: 'Black man in his twenties in a creator studio' },
  leila: { alt: 'Middle Eastern woman in a hijab laughing in a cafe' },
  ravi: { alt: 'South Asian tech reviewer with glasses at his desk' },
  mei: { alt: 'East Asian beauty creator in soft studio light' },
  sofia: { alt: 'Latina fitness creator outdoors at golden hour' },
  jonas: { alt: 'White travel vlogger with a camera strap' },
  grace: { alt: 'Black woman in her fifties in a bright kitchen' },
};

/** Display order for the hero strip — mixed ages, genders and backgrounds. */
export const PORTRAIT_STRIP: PortraitKey[] = ['selam', 'ravi', 'amara', 'leila', 'kofi', 'mei', 'sofia', 'jonas', 'grace'];

export const portraitSrc = (key: PortraitKey) => `/images/creators/${key}.jpg`;
