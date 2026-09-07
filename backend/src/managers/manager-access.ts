import { ForbiddenException } from '@nestjs/common';

/** One brand's engagement of an account manager, as it travels on the request. */
export interface ManagerEngagement {
  brandId: string;
  permissions: Record<string, boolean>;
  grant: { campaign_limit?: number | null; budget_cap?: number | null; campaigns?: string[] } | null;
}

export const engagementsOf = (user: any): ManagerEngagement[] => (Array.isArray(user?.managedBrands) ? user.managedBrands : []);

export const isManager = (user: any): boolean => String(user?.role || '').toLowerCase() === 'manager';

/** The engagement covering this brand, or a 403 explaining what is missing. */
export const engagementFor = (user: any, brandId: string): ManagerEngagement => {
  const hit = engagementsOf(user).find((e) => e.brandId === brandId);
  if (!hit) throw new ForbiddenException('You are not engaged by this brand. Offer to manage one of their campaigns first.');
  return hit;
};

/** Brands a manager may act for at all. */
export const managedBrandIds = (user: any): string[] => engagementsOf(user).map((e) => e.brandId);

/** Campaigns a manager may act on for one brand: the ones assigned to them plus the ones they created. */
export const assignedCampaignIds = (engagement: ManagerEngagement): string[] => (Array.isArray(engagement.grant?.campaigns) ? engagement.grant!.campaigns! : []);

export const requireManagerPermission = (engagement: ManagerEngagement, permission: string, label: string) => {
  if (!engagement.permissions?.[permission]) {
    throw new ForbiddenException(`This brand has not allowed you to ${label}. Ask them to grant it from My team.`);
  }
};
