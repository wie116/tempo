interface DocumentPictureInPictureApi {
  window: Window | null;
  requestWindow: (options?: {
    width?: number;
    height?: number;
    disallowReturnToOpener?: boolean;
  }) => Promise<Window>;
}

type PictureInPictureCapableWindow = Window & {
  documentPictureInPicture?: DocumentPictureInPictureApi;
};

export const supportsDocumentPictureInPicture = () =>
  Boolean((window as PictureInPictureCapableWindow).documentPictureInPicture);

/** Copia el CSS actual para que el portal conserve theme y tipografía. */
function copyStyles(target: Document): void {
  for (const sheet of Array.from(document.styleSheets)) {
    if (sheet.href) {
      const link = target.createElement('link');
      link.rel = 'stylesheet';
      link.href = sheet.href;
      target.head.append(link);
      continue;
    }

    try {
      const style = target.createElement('style');
      style.textContent = Array.from(sheet.cssRules).map((rule) => rule.cssText).join('\n');
      target.head.append(style);
    } catch {
      // Una hoja de otro origen puede impedir leer cssRules. En producción,
      // Tempo sirve su hoja desde el mismo origen y no entra en este caso.
    }
  }
}

export async function openFocusPictureInPicture(title = 'Tempo · Concentración'): Promise<Window | null> {
  const api = (window as PictureInPictureCapableWindow).documentPictureInPicture;
  if (!api) return null;
  if (api.window && !api.window.closed) {
    api.window.focus();
    return api.window;
  }

  const floating = await api.requestWindow({ width: 420, height: 590 });
  floating.document.title = title;
  floating.document.documentElement.dataset.theme = document.documentElement.dataset.theme;
  floating.document.documentElement.dataset.font = document.documentElement.dataset.font;
  floating.document.documentElement.style.height = '100%';
  floating.document.body.style.height = '100%';
  floating.document.body.style.margin = '0';
  copyStyles(floating.document);
  return floating;
}
