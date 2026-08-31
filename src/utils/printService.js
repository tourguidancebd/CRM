/**
 * PrintService — iframe-based print with HTML download fallback.
 * Avoids popup blocker issues entirely.
 */

export function parseReceiptNote(note) {
  if (!note) return { paymentMethod: 'Cash', accountName: 'Main Office Cash Vault', cleanNote: '' }
  let paymentMethod = 'Cash'
  let accountName = 'Main Office Cash Vault'
  let cleanNote = String(note)

  const methodMatch = cleanNote.match(/\[Paid Via:\s*([^\]]+)\]/)
  if (methodMatch) {
    paymentMethod = methodMatch[1].trim()
    cleanNote = cleanNote.replace(/\[Paid Via:\s*([^\]]+)\]/, '').trim()
  }

  const accMatch = cleanNote.match(/\[Received To:\s*([^\]]+)\]/)
  if (accMatch) {
    accountName = accMatch[1].trim()
    cleanNote = cleanNote.replace(/\[Received To:\s*([^\]]+)\]/, '').trim()
  }

  return { paymentMethod, accountName, cleanNote }
}

/**
 * Print an HTML string using a hidden iframe.
 * @param {string} htmlContent - Complete HTML document string
 * @param {string} title - Window title for the print dialog
 */
export function printHtml(htmlContent, title = 'Print') {
  // Remove any existing print iframe
  const existingFrame = document.getElementById('tgbd-print-frame')
  if (existingFrame) existingFrame.remove()

  const iframe = document.createElement('iframe')
  iframe.id = 'tgbd-print-frame'
  iframe.style.cssText = `
    position: fixed;
    top: -9999px;
    left: -9999px;
    width: 0;
    height: 0;
    border: none;
    visibility: hidden;
  `
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument || iframe.contentWindow.document
  doc.open()
  doc.write(htmlContent)
  doc.close()

  // Wait for images/fonts to load before printing
  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow.focus()
        iframe.contentWindow.print()
      } catch (e) {
        console.error('Print error:', e)
        downloadHtml(htmlContent, title)
      }
    }, 300)
  }

  // Fallback if onload doesn't fire
  setTimeout(() => {
    try {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
    } catch (e) {
      downloadHtml(htmlContent, title)
    }
  }, 1000)
}

/**
 * Download an HTML string as a .html file.
 * @param {string} htmlContent
 * @param {string} filename
 */
export function downloadHtml(htmlContent, filename = 'document') {
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename.replace(/[^a-z0-9]/gi, '_')}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Base print CSS for all letterhead documents.
 */
export const PRINT_BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', sans-serif;
    font-size: 12px;
    color: #1a1a2e;
    background: #fff;
    padding: 20px;
  }

  .letterhead {
    max-width: 800px;
    margin: 0 auto;
    background: #fff;
  }

  .lh-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 16px;
    border-bottom: 2px solid #C9A24B;
    margin-bottom: 20px;
  }

  .lh-logo { height: 60px; object-fit: contain; }

  .lh-company-info { text-align: right; }
  .lh-company-name {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 18px;
    font-weight: 700;
    color: #0A0F1C;
    margin-bottom: 4px;
  }
  .lh-company-detail { color: #555; line-height: 1.5; }

  .doc-title {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 22px;
    font-weight: 700;
    text-align: center;
    color: #0A0F1C;
    margin: 16px 0 4px;
    letter-spacing: 0.5px;
  }

  .travel-date-banner {
    background: #C9A24B;
    color: #fff;
    text-align: center;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 15px;
    font-weight: 700;
    padding: 8px 16px;
    border-radius: 4px;
    margin: 12px 0;
    letter-spacing: 0.5px;
  }

  .doc-meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin: 16px 0;
    padding: 12px 16px;
    background: #f9f9f9;
    border-radius: 6px;
    border: 1px solid #eee;
  }
  .doc-meta-row { display: flex; gap: 8px; }
  .doc-meta-label { color: #777; font-weight: 500; min-width: 120px; }
  .doc-meta-value { color: #1a1a2e; font-weight: 600; }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 11.5px;
  }

  thead th {
    background: #0A0F1C;
    color: #fff;
    padding: 8px 10px;
    text-align: left;
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 600;
    letter-spacing: 0.3px;
  }

  tbody tr:nth-child(even) { background: #f8f8f8; }

  tbody td {
    padding: 7px 10px;
    border-bottom: 1px solid #eee;
    color: #333;
  }

  .amount-col { text-align: right; font-family: 'JetBrains Mono', monospace; }

  .totals-section {
    margin-left: auto;
    width: 300px;
    margin-top: 8px;
  }

  .totals-row {
    display: flex;
    justify-content: space-between;
    padding: 5px 0;
    border-bottom: 1px solid #eee;
  }

  .totals-row.grand-total {
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 700;
    font-size: 14px;
    border-top: 2px solid #0A0F1C;
    border-bottom: 2px solid #0A0F1C;
    padding: 8px 0;
    margin-top: 4px;
  }

  .totals-row.due-row { color: #d32f2f; font-weight: 600; }
  .totals-row.paid-row { color: #2e7d32; font-weight: 600; }

  .bank-box {
    margin-top: 20px;
    padding: 12px 16px;
    border: 1.5px solid #C9A24B;
    border-radius: 6px;
    background: #fffdf5;
  }
  .bank-box-title {
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 700;
    color: #C9A24B;
    margin-bottom: 8px;
    font-size: 13px;
  }
  .bank-detail { color: #333; margin: 2px 0; }

  .signature-section {
    display: flex;
    justify-content: flex-end;
    margin-top: 40px;
    text-align: center;
  }
  .signature-block {
    width: 180px;
  }
  .signature-img {
    height: 60px;
    object-fit: contain;
    margin-bottom: 4px;
  }
  .signature-line {
    border-top: 1px solid #333;
    padding-top: 4px;
    color: #555;
    font-size: 11px;
  }

  .lh-footer {
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid #ddd;
    text-align: center;
    color: #777;
    font-size: 10.5px;
    line-height: 1.6;
  }

  .grand-total-row td {
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 700;
    background: #0A0F1C !important;
    color: #fff !important;
    padding: 9px 10px;
  }

  .status-paid { color: #2e7d32; font-weight: 600; }
  .status-partial { color: #e65100; font-weight: 600; }
  .status-due { color: #d32f2f; font-weight: 600; }

  @media print {
    body { padding: 0; }
    @page { margin: 15mm 15mm 15mm 15mm; size: A4; }
    .no-print { display: none !important; }
  }
`

/**
 * Wrap content HTML in a full letterhead document.
 */
export function buildLetterheadDoc({ title, content, company, extraCss = '' }) {
  const companyName = company?.name || 'Tour Guidance BD'
  const companyAddress = company?.address || ''
  const companyPhone = company?.phone || ''
  const companyEmail = company?.email || ''
  const companyWebsite = company?.website || ''
  const companyLogo = company?.logo || ''
  const companyFooter = company?.footer || ''
  const authoritySignature = company?.authoritySignature || ''

  const logoHtml = companyLogo
    ? `<img src="${escapeAttr(companyLogo)}" alt="Logo" class="lh-logo" />`
    : `<div class="lh-logo-placeholder" style="width:80px;height:60px;"></div>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)} — ${escapeHtml(companyName)}</title>
<style>
${PRINT_BASE_CSS}
${extraCss}
</style>
</head>
<body>
<div class="letterhead">
  <div class="lh-header">
    ${logoHtml}
    <div class="lh-company-info">
      <div class="lh-company-name">${escapeHtml(companyName)}</div>
      <div class="lh-company-detail">
        ${companyAddress ? escapeHtml(companyAddress) + '<br>' : ''}
        ${companyPhone ? '📞 ' + escapeHtml(companyPhone) : ''}
        ${companyEmail ? ' | ✉ ' + escapeHtml(companyEmail) : ''}
        ${companyWebsite ? '<br>' + escapeHtml(companyWebsite) : ''}
      </div>
    </div>
  </div>

  ${content}

  ${companyFooter ? `<div class="lh-footer">${escapeHtml(companyFooter)}</div>` : ''}
</div>
</body>
</html>`
}

/**
 * Escape HTML for safe output
 */
export function escapeHtml(str) {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Escape for HTML attribute values
 */
export function escapeAttr(str) {
  if (str == null) return ''
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}
