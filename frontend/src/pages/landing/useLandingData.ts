import { useEffect, useState } from 'react';
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

export type LandingData = {
  settings: LandingSettings;
  reviews: Review[];
  activeCampaigns: ActiveCampaign[];
  campaignsLoading: boolean;
  refetchReviews: () => void;
};

export function useLandingData(): LandingData {
  const [settings, setSettings] = useState<LandingSettings>({
    ticker_enabled: 'true',
    ticker_text: 'Spotify · LVMH · Epic Games · Adidas · RedBull · Gymshark · Nike · Samsung',
    notifications_enabled: 'true',
    notifications_mock_enabled: 'true',
    stats_use_real_data: 'false',
    for_brands_enabled: 'true',
    for_creators_enabled: 'true',
    testimonials_enabled: 'true',
    testimonials_mock_enabled: 'true',
    faq_enabled: 'true',
    contact_enabled: 'true',
  });
  const [reviews, setReviews] = useState<Review[]>([]);
  const [activeCampaigns, setActiveCampaigns] = useState<ActiveCampaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);

  const fetchReviews = () =>
    api.get('/public/reviews').then((res) => setReviews(res.data || [])).catch(() => {});

  useEffect(() => {
    api.get('/public/settings').then((res) => {
      setSettings((prev) => ({ ...prev, ...res.data }));
    }).catch(() => {});

    fetchReviews();

    api.get('/campaigns/active').then((res) => {
      setActiveCampaigns(res.data || []);
    }).catch(() => {}).finally(() => setCampaignsLoading(false));
  }, []);

  return {
    settings,
    reviews,
    activeCampaigns,
    campaignsLoading,
    refetchReviews: fetchReviews,
  };
}
