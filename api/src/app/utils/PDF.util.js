/**
 * Real implementation is Puppeteer + Handlebars, pooled (see docs/backend/03-api-spec.md §9).
 * Deliberately NOT wired up yet — Puppeteer/Handlebars aren't in package.json so `npm install`
 * stays fast and doesn't pull Chromium for a server that's only returning mock data right now.
 * This stub returns a tiny, genuinely-valid single-page PDF so FE can build the "embed/download
 * a PDF" UI against a real `application/pdf` response today. Swap the body of `renderPdf` for
 * a real Puppeteer call when Document.helper.js stops reading from mocks/.
 */

// A minimal valid one-page PDF ("Mock document — TCOS Finance Tracking"), hand-built so no
// dependency is needed to produce it.
const MOCK_PDF_BASE64 =
  "JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8" +
  "PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVu" +
  "dCAyIDAgUi9NZWRpYUJveFswIDAgNjEyIDc5Ml0vQ29udGVudHMgNCAwIFIvUmVzb3VyY2VzPDwvRm9udDw8L0Yx" +
  "IDUgMCBSPj4+Pj4+ZW5kb2JqCjQgMCBvYmo8PC9MZW5ndGggNzM+PnN0cmVhbQpCVCAvRjEgMjQgVGYgNzIgNzAw" +
  "IFRkIChNb2NrIGRvY3VtZW50IOKAlCBUQ09TIEZpbmFuY2UgVHJhY2tpbmcpIFRqIEVUCmVuZHN0cmVhbQplbmRv" +
  "YmoKNSAwIG9iajw8L1R5cGUvRm9udC9TdWJ0eXBlL1R5cGUxL0Jhc2VGb250L0hlbHZldGljYT4+ZW5kb2JqCnhy" +
  "ZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKdHJhaWxlcjw8L1NpemUgNi9Sb290IDEgMCBSPj4Kc3RhcnR4cmVm" +
  "CjAKJSVFT0Y=";

async function renderPdf(_templateName, _data) {
  return Buffer.from(MOCK_PDF_BASE64, "base64");
}

async function renderHtml(_templateName, data) {
  return `<pre>MOCK — templates not wired up yet. Data that would render:\n${JSON.stringify(
    data,
    null,
    2
  )}</pre>`;
}

module.exports = { renderPdf, renderHtml };
