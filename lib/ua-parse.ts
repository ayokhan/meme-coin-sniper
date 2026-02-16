/**
 * Parse User-Agent for device type, browser, and OS (no external deps).
 */
export function parseUserAgent(ua: string | null | undefined): { deviceType: string; browser: string; os: string } {
  const s = ua ?? '';
  let deviceType = 'desktop';
  if (/Mobile|Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(s) && !/iPad|Tablet/i.test(s)) {
    deviceType = 'mobile';
  } else if (/iPad|Tablet|Android(?!.*Mobile)/i.test(s)) {
    deviceType = 'tablet';
  }
  let browser = 'Other';
  if (/Edg\//i.test(s)) browser = 'Edge';
  else if (/Chrome\//i.test(s) && !/Edg/i.test(s)) browser = 'Chrome';
  else if (/Safari\//i.test(s) && !/Chrome/i.test(s)) browser = 'Safari';
  else if (/Firefox\//i.test(s)) browser = 'Firefox';
  else if (/OPR\//i.test(s) || /Opera\//i.test(s)) browser = 'Opera';
  let os = 'Other';
  if (/Windows NT/i.test(s)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(s)) os = 'macOS';
  else if (/Android/i.test(s)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(s)) os = 'iOS';
  else if (/Linux/i.test(s)) os = 'Linux';
  return { deviceType, browser, os };
}
