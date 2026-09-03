const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? "https://novastaris.ai").replace(/\/$/, "");

export type PartnerBrandEmail = "blofin" | "coinbase" | "vantage" | "tiomarkets" | "assexmarkets";

const PARTNER_LABEL: Record<PartnerBrandEmail, string> = {
  blofin: "Blofin",
  coinbase: "Coinbase",
  vantage: "Vantage Markets",
  tiomarkets: "TIOmarkets",
  assexmarkets: "Assexmarkets",
};

function partnerEmailImg(partner: PartnerBrandEmail): { src: string; alt: string; width: number } {
  if (partner === "coinbase") {
    return { src: `${APP_ORIGIN}/partners/coinbase-logo.svg`, alt: "Coinbase", width: 130 };
  }
  if (partner === "vantage") {
    return { src: `${APP_ORIGIN}/partners/vantage-logo.png`, alt: "Vantage Markets", width: 150 };
  }
  if (partner === "tiomarkets") {
    return { src: `${APP_ORIGIN}/partners/tiomarkets-logo.png`, alt: "TIOmarkets", width: 150 };
  }
  if (partner === "assexmarkets") {
    return { src: `${APP_ORIGIN}/partners/assexmarkets-logo.png`, alt: "Assexmarkets", width: 48 };
  }
  return { src: `${APP_ORIGIN}/partners/blofin-logo-light.png`, alt: "Blofin", width: 140 };
}

/**
 * Branded partnership header for emails (dark band — reads as a banner, not a grey chip).
 * Uses partner PNG + NovaStaris text wordmark (SVG logos often fail in Gmail/Outlook).
 */
export function partnerLogosEmailHtml(partner: PartnerBrandEmail = "blofin"): string {
  const p = partnerEmailImg(partner);
  const label = PARTNER_LABEL[partner];
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 0 0;border-collapse:collapse;">
  <tr>
    <td align="center" style="background:#0a0a0b;background-image:linear-gradient(135deg,#0a0a0b 0%,#18181b 55%,#042f2e 100%);padding:28px 24px 24px 24px;">
      <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#a1a1aa;">
        NovaStaris &times; ${label}
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 auto;">
        <tr>
          <td align="center" valign="middle" style="padding:0 10px;">
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;color:#fafafa;letter-spacing:-0.02em;line-height:1;">NovaStaris</span>
          </td>
          <td align="center" valign="middle" style="padding:0 6px;">
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;color:#71717a;">&times;</span>
          </td>
          <td align="center" valign="middle" style="padding:0 10px;">
            <img src="${p.src}" alt="${p.alt}" width="${p.width}" style="display:block;height:36px;width:auto;max-width:160px;border:0;outline:none;" />
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();
}
