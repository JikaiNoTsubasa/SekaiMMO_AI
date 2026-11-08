/**
 * Convertit un chemin d'asset stocké en base (iconUrl) en URL web.
 * La base peut contenir "public/assets/..." : Vite sert le dossier public à la racine.
 */
export function resolveAssetUrl(iconUrl: string | null | undefined): string | undefined {
  const url = iconUrl?.trim();
  if (!url) return undefined;
  if (/^(https?:)?\/\//.test(url)) return url;
  return '/' + url.replace(/^\/+/, '').replace(/^public\//, '');
}
