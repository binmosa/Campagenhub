import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';

/**
 * useLandingData — central source for the landing page's API state.
 *
 * Consolidates the four fetches the legacy Landing.tsx did inline:
 *   - /public/settings   → admin-controlled copy + section toggles
 *   - /public/activity   → live activity (for notifications popup, future use)
 *   - /public/reviews    → user-submitted testimonials
 *   - /campaigns/active  → active campaigns shown on the landing
 *
 * Each fetch falls back gracefully so a backend hiccup never blanks the page.
 */

export type LandingSettings = {
  ticker_enabled?: string;
  ticker_text?: string;
  notifications_enabled?: string;
  notifications_mock_enabled?: string;
  stats_use_real_data?: string;
  for_brands_enabled?: string;
  for_creators_enabled?: string;
  testimonials_enabled?: string;
  testimonials_mock_enabled?: string;
  faq_enabled?: string;
  contact_enabled?: string;
  /** Sections built on sample data (the payout strip, the results showcase).
   *  Off unless an admin opts in — they illustrate the product, they do not
   *  report anything the platform has done. */
  showcase_demo_enabled?: string;

  // Hero
  hero_title?: string;
  hero_subtitle?: string;
  about_text?: string;
  hero_btn_primary?: string;
  hero_btn_secondary?: string;
  hero_btn_dashboard?: string;
  hero_bg_image?: string;

  // Stats (4 tiles)
  stats_val_1?: string;  stats_lbl_1?: string;
  stats_val_2?: string;  stats_lbl_2?: string;
  stats_val_3?: string;  stats_lbl_3?: string;
  stats_val_4?: string;  stats_lbl_4?: string;

  // AI Studio promo
  ai_studio_title?: string;
  ai_studio_subtitle?: string;
  ai_studio_main_title?: string;
  ai_studio_desc?: string;
  ai_studio_btn?: string;

  // For Brands / For Creators
  brands_title?: string;       brands_desc?: string;
  creators_title?: string;     creators_desc?: string;
  creators_badge?: string;
  creators_btn_primary?: string;
  creators_btn_dashboard?: string;

  // How it works
  how_it_works_title?: string;
  how_it_works_desc?: string;
  how_it_works_image?: string;

  // Active campaigns
  active_camp_title?: string;
  active_camp_desc?: string;
  active_camp_btn?: string;

  // CTA
  cta_title?: string;
  cta_desc?: string;

  // Testimonials
  testimonials_title?: string;
  testimonials_desc?: string;

  // Contact + Newsletter
  contact_badge?: string;
  contact_title?: string;
  contact_desc?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_loc?: string;
  newsletter_badge?: string;
  newsletter_title?: string;
  newsletter_desc?: string;
  newsletter_btn?: string;
  newsletter_stats_1?: string;  newsletter_lbl_1?: string;
  newsletter_stats_2?: string;  newsletter_lbl_2?: string;
  newsletter_stats_3?: string;  newsletter_lbl_3?: string;
};

export type Review = {
  id?: string | number;
  user_name?: string;
  user_role?: string;
  comment?: string;
  rating?: number;
};

export type ActiveCampaign = {
  id: string;
  title: string;
  description?: string;
  budget?: number;
  platform?: string;
  target_audience?: string;
  status?: string;
  brand?: { id?: string; email?: string; brandProfile?: { company_name?: string; logo_url?: string } };
};

/** Live counts from the platform's own tables. */
export type PlatformStats = {
  creatorCount: number;
  brandCount: number;
  activeCampaigns: number;
  totalApplications: number;
};

export type LandingData = {
  settings: LandingSettings;
  reviews: Review[];
  activeCampaigns: ActiveCampaign[];
  campaignsLoading: boolean;
  platformStats: PlatformStats | null;
  refetchReviews: () => void;
};

export function useLandingData(): LandingData {
  const [settings, setSettings] = useState<LandingSettings>({
    /* First paint, before /public/settings answers — and the permanent
       state if that call fails. Nothing here may assert a customer, a
       figure or a quote the platform cannot evidence. */
    ticker_enabled: 'true',
    ticker_text: '',
    notifications_enabled: 'true',
    notifications_mock_enabled: 'false',
    stats_use_real_data: 'true',
    for_brands_enabled: 'true',
    for_creators_enabled: 'true',
    testimonials_enabled: 'true',
    testimonials_mock_enabled: 'false',
    faq_enabled: 'true',
    contact_enabled: 'true',
  });
  const [reviews, setReviews] = useState<Review[]>([]);
  const { i18n } = useTranslation();
  const [activeCampaigns, setActiveCampaigns] = useState<ActiveCampaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);

  const fetchReviews = () =>
    api.get('/public/reviews').then((res) => setReviews(res.data || [])).catch(() => {});

  useEffect(() => {
    api.get('/public/settings').then((res) => {
      setSettings((prev) => ({ ...prev, ...res.data }));
    }).catch(() => {});

    // Real counts for the statistics row. Without them the section shows
    // nothing rather than inventing a number.
    api
      .get('/public/platform-stats')
      .then((res) => setPlatformStats(res.data || null))
      .catch(() => setPlatformStats(null));

    fetchReviews();

    // Paginated endpoint: same payload shape as the /campaigns board,
    // including per-campaign applicant counts for the shared card.
    api.get('/campaigns/public-list', { params: { limit: '6', lang: i18n.language } }).then((res) => {
      setActiveCampaigns(res.data?.items || []);
    }).catch(() => {}).finally(() => setCampaignsLoading(false));
  }, [i18n.language]);

  return {
    settings,
    reviews,
    activeCampaigns,
    campaignsLoading,
    platformStats,
    refetchReviews: fetchReviews,
  };
}
