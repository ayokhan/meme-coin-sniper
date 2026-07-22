const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? "https://novastaris.ai").replace(/\/$/, "");

export type PartnerBrandEmail = "blofin" | "vantage" | "tiomarkets" | "assexmarkets";

function partnerEmailImg(partner: PartnerBrandEmail): { src: string; alt: string; width: number } {
  if (partner === "vantage") {
    return { src: `${APP_ORIGIN}/partners/vantage-logo.png`, alt: "Vantage", width: 160 };
  }
  if (partner === "tiomarkets") {
    return { src: `${APP_ORIGIN}/partners/tiomarkets-logo.png`, alt: "TIOmarkets", width: 140 };
  }
  if (partner === "assexmarkets") {
    return { src: `${APP_ORIGIN}/partners/assexmarkets-logo.png`, alt: "Assexmarkets", width: 48 };
  }
  return { src: `${APP_ORIGIN}/partners/blofin-logo-dark.png`, alt: "Blofin", width: 140 };
}

/** HTML block for NovaStaris × partner logos in announcement emails (light background). */
export function partnerLogosEmailHtml(partner: PartnerBrandEmail = "blofin"): string {
  const p = partnerEmailImg(partner);
  const partnerCellBg = partner === "tiomarkets" ? "background:#09090b;border-radius:6px;padding:6px 8px;" : "";
  return `
<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 24px auto;">
  <tr>
    <td style="padding:14px 20px;background:#f4f4f5;border:1px solid #e4e4e7;border-radius:12px;text-align:center;">
      <img src="${APP_ORIGIN}/partners/novastaris-logo.svg" alt="NovaStaris" width="168" height="40" style="display:inline-block;vertical-align:middle;height:32px;width:auto;margin-right:12px;" />
      <span style="color:#a1a1aa;font-size:11px;font-weight:700;vertical-align:middle;padding:0 4px;">×</span>
      <span style="display:inline-block;vertical-align:middle;margin-left:12px;${partnerCellBg}">
        <img src="${p.src}" alt="${p.alt}" width="${p.width}" height="40" style="display:inline-block;vertical-align:middle;height:32px;width:auto;" />
      </span>
    </td>
  </tr>
</table>`.trim();
}
