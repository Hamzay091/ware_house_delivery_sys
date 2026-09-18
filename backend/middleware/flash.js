/**
 * Minimal session flash messages.
 *
 * Replaces the old pattern of stuffing human-readable errors into query
 * strings, which leaked wording into the URL bar and survived refreshes.
 *
 *   req.flash('success', 'Item saved.')   // queue for the next render
 *   res.locals.flash                      // drained array, for the view
 */
const TYPES = new Set(['success', 'error', 'warning', 'info']);

module.exports = (req, res, next) => {
  req.flash = (type, message) => {
    if (!req.session) return;
    if (!TYPES.has(type)) type = 'info';
    if (!message) return;
    if (!Array.isArray(req.session.flash)) req.session.flash = [];
    req.session.flash.push({ type, message: String(message) });
  };

  const queued = (req.session && Array.isArray(req.session.flash)) ? req.session.flash : [];
  res.locals.flash = queued;
  if (req.session) req.session.flash = [];

  next();
};
