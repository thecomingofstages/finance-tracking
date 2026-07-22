const Papa = require("papaparse");

/**
 * Parses a CSV buffer into row objects keyed by header. Real column-mapping (Google Form
 * headers aren't stable across forms — see docs/backend/03-api-spec.md §9) is a per-project
 * config that isn't built yet; this just gets structured rows out of the file.
 */
function parse(buffer) {
  const text = buffer.toString("utf8");
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });
  return { rows: result.data, errors: result.errors };
}

module.exports = { parse };
