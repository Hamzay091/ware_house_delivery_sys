/**
 * CSV export helpers.
 *
 * Values are quoted and internal quotes doubled per RFC 4180. Cells that
 * begin with =, +, - or @ are prefixed with a single quote so spreadsheet
 * software treats them as text rather than executing them as formulas.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value) {
  if (value === null || value === undefined) return '""';
  let text = String(value);
  if (FORMULA_START.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

/** Serialises rows (arrays of values) under the given header labels. */
function toCsv(headers, rows) {
  const lines = [headers.map(cell).join(',')];
  rows.forEach((row) => lines.push(row.map(cell).join(',')));
  // BOM so Excel opens UTF-8 exports with the right encoding.
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** Sends a CSV download response. */
function sendCsv(res, filename, headers, rows) {
  const safeName = String(filename).replace(/[^A-Za-z0-9._-]/g, '_');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.send(toCsv(headers, rows));
}

module.exports = { toCsv, sendCsv };
