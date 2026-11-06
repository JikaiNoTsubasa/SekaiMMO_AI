// Police pixel du jeu (déclarée en @font-face dans style.css)
// Press Start 2P est nette uniquement aux multiples de 8px.
export const PIXEL_FONT = "'Press Start 2P', Arial";

export const loadPixelFont = (): Promise<unknown> =>
  document.fonts.load("8px 'Press Start 2P'").catch(() => undefined);
