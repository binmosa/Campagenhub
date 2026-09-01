/**
 * Names are stored as first_name + last_name; full_name is DERIVED and kept
 * in sync on every write, so display code (cards, invitations, AI prompts)
 * can keep reading full_name while emails and messages greet by first_name.
 *
 * For legacy rows that only carry full_name, greet with:
 *   first_name || full_name?.split(' ')[0]
 */
export const withDerivedFullName = <T extends Record<string, any>>(data: T): T => {
  const first = typeof data.first_name === 'string' ? data.first_name.trim() : '';
  const last = typeof data.last_name === 'string' ? data.last_name.trim() : '';
  if (!first && !last) return data;
  return {
    ...data,
    first_name: first,
    last_name: last,
    full_name: [first, last].filter(Boolean).join(' '),
  };
};
