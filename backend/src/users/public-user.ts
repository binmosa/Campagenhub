/**
 * toPublicUser — the only shape of a User that may leave the API when the
 * row belongs to someone else (a creator on an application, a member on a
 * team, the counterparty on an invitation).
 *
 * The full entity carries password_hash, KYC documents (base64 blobs),
 * telegram tokens and referral codes; none of that is ever a client's
 * business. Profile relations are passed through when loaded.
 */
export const toPublicUser = (u: any): any => {
  if (!u || typeof u !== 'object') return u;
  const { id, email, role, account_status, created_at, creatorProfile, brandProfile, managerProfile } = u;
  return {
    id,
    email,
    role,
    account_status,
    created_at,
    ...(creatorProfile !== undefined ? { creatorProfile } : {}),
    ...(brandProfile !== undefined ? { brandProfile } : {}),
    ...(managerProfile !== undefined ? { managerProfile } : {}),
  };
};
