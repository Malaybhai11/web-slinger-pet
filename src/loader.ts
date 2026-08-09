/**
 * loader.ts — Single-instance sprite sheet loader & chroma-key pre-processor.
 * Ensures the sprite sheet asset is loaded exactly once and cached in an offscreen canvas.
 */

export class SpriteSheetLoader {
  private static instance: SpriteSheetLoader | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private loaded = false;
  private loadPromise: Promise<HTMLCanvasElement> | null = null;

  private constructor() {}

  public static getInstance(): SpriteSheetLoader {
    if (!SpriteSheetLoader.instance) {
      SpriteSheetLoader.instance = new SpriteSheetLoader();
    }
    return SpriteSheetLoader.instance;
  }

  public load(url: string = '/spidey-spritesheet.png'): Promise<HTMLCanvasElement> {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = new Promise<HTMLCanvasElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;

      img.onload = () => {
        const offscreen = document.createElement('canvas');
        offscreen.width = img.width;
        offscreen.height = img.height;
        const octx = offscreen.getContext('2d');

        if (!octx) {
          reject(new Error('Failed to get 2D context for offscreen sprite canvas'));
          return;
        }

        octx.drawImage(img, 0, 0);

        // Chroma-key out grey background (RGB ~180, 180, 180)
        const imgData = octx.getImageData(0, 0, img.width, img.height);
        const d = imgData.data;

        const bgR = d[(5 * img.width + 5) * 4 + 0];
        const bgG = d[(5 * img.width + 5) * 4 + 1];
        const bgB = d[(5 * img.width + 5) * 4 + 2];

        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          const diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
          if (diff < 40) {
            d[i + 3] = 0; // Make background transparent
          }
        }

        octx.putImageData(imgData, 0, 0);
        this.canvas = offscreen;
        this.loaded = true;
        resolve(offscreen);
      };

      img.onerror = (err) => {
        reject(err);
      };
    });

    return this.loadPromise;
  }

  public isLoaded(): boolean {
    return this.loaded;
  }

  public getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }
}
