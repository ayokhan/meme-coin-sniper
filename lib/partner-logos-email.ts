const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? "https://novastaris.ai").replace(/\/$/, "");

/** HTML block for NovaStaris × Blofin logos in announcement emails. */
export function partnerLogosEmailHtml(): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 20px auto;">
  <tr>
    <td style="padding:8px 12px;background:#0B0F14;border-radius:8px;text-align:center;">
      <img src="${APP_ORIGIN}/partners/novastaris-logo.svg" alt="NovaStaris" width="120" height="32" style="display:inline-block;vertical-align:middle;height:28px;width:auto;" />
      <span style="color:#67e8f9;font-size:11px;font-weight:700;padding:0 8px;vertical-align:middle;">×</span>
      <img src="${APP_ORIGIN}/partners/blofin-logo.svg" alt="Blofin" width="120" height="32" style="display:inline-block;vertical-align:middle;height:28px;width:auto;" />
    </td>
  </tr>
</table>`.trim();
}
