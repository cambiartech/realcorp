export function captureFormEmbedPath(tenantSlug: string, formSlug: string): string {
  return `/f/embed/${tenantSlug}/${formSlug}`;
}

export function buildEmbedSnippet(siteOrigin: string, tenantSlug: string, formSlug: string): string {
  const src = `${siteOrigin}${captureFormEmbedPath(tenantSlug, formSlug)}`;
  return `<iframe src="${src}" width="100%" height="720" style="border:none;border-radius:12px;max-width:480px" title="Contact form"></iframe>`;
}

export function qrCodeImageUrl(data: string, size = 240): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&margin=8`;
}
