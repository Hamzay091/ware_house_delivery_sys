/**
 * Helpers for the list pages: pagination, whitelisted sorting, and safe
 * regex search. Everything here treats the query string as hostile input.
 */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Escapes a user-supplied string so it can be used literally inside a RegExp. */
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Builds a case-insensitive "contains" regex, or null for an empty search. */
function searchRegex(value) {
  const term = (value || '').trim();
  if (!term) return null;
  return new RegExp(escapeRegex(term), 'i');
}

/**
 * Reads `page` and `limit` from the query string and clamps them.
 * Anything missing, unparseable or non-positive falls back to the default,
 * and `limit` is capped so a single request cannot ask for the whole table.
 */
function paginate(query, defaultLimit = DEFAULT_LIMIT) {
  const parsedPage = parseInt(query.page, 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const parsedLimit = parseInt(query.limit, 10);
  const requested = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : defaultLimit;
  const limit = Math.min(MAX_LIMIT, requested);

  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Turns `?sort=name&dir=desc` into a Mongo sort object, but only for fields
 * the caller explicitly allows — an arbitrary sort key is a cheap way to
 * make the database scan something it has no index for.
 */
function sortSpec(query, allowed, fallback) {
  const field = allowed.includes(query.sort) ? query.sort : fallback;
  const dir = query.dir === 'asc' ? 1 : query.dir === 'desc' ? -1 : (field === fallback ? -1 : 1);
  return { spec: { [field]: dir }, field, dir: dir === 1 ? 'asc' : 'desc' };
}

/** Assembles the pagination object the `_pagination` partial expects. */
function pageMeta({ page, limit }, total, query, omit = ['page']) {
  const params = new URLSearchParams();
  Object.keys(query || {}).forEach((key) => {
    if (omit.includes(key)) return;
    const value = query[key];
    if (value === undefined || value === null || value === '') return;
    params.append(key, String(value));
  });
  return {
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
    baseQuery: params.toString()
  };
}

/**
 * Builds the href for a sortable column header, preserving the other filters
 * and flipping direction when the column is already the active sort.
 */
function sortLink(query, field, activeField, activeDir) {
  const params = new URLSearchParams();
  Object.keys(query || {}).forEach((key) => {
    if (key === 'sort' || key === 'dir' || key === 'page') return;
    const value = query[key];
    if (value === undefined || value === null || value === '') return;
    params.append(key, String(value));
  });
  params.append('sort', field);
  params.append('dir', field === activeField && activeDir === 'asc' ? 'desc' : 'asc');
  return '?' + params.toString();
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  escapeRegex,
  searchRegex,
  paginate,
  sortSpec,
  pageMeta,
  sortLink
};
