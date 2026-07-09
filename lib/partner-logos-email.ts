const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? "https://novastaris.ai").replace(/\/$/, "");

/** HTML block for NovaStaris × Blofin logos in announcement emails (light background). */
export function partnerLogosEmailHtml(): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 24px auto;">
  <tr>
    <td style="padding:14px 20px;background:#f4f4f5;border:1px solid #e4e4e7;border-radius:12px;text-align:center;">
      <img src="${APP_ORIGIN}/partners/novastaris-logo.svg" alt="NovaStaris" width="168" height="40" style="display:inline-block;vertical-align:middle;height:32px;width:auto;margin-right:12px;" />
      <span style="color:#a1a1aa;font-size:11px;font-weight:700;vertical-align:middle;padding:0 4px;">×</span>
      <img src="${APP_ORIGIN}/partners/blofin-logo-dark.png" alt="Blofin" width="140" height="40" style="display:inline-block;vertical-align:middle;height:32px;width:auto;margin-left:12px;" />
    </td>
  </tr>
</table>`.trim();
}
