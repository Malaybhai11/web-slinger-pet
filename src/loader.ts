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

    this.loadPromise = new Promise<HTMLCanvasElement>((resolve) => {
      const candidateUrls = [
        url,
        '/spidey-spritesheet.png',
        'spidey-spritesheet.png',
        './spidey-spritesheet.png',
        '/spidey-spritesheet.jpg',
        'spidey-spritesheet.jpg',
      ];

      const tryNextUrl = (index: number) => {
        if (index >= candidateUrls.length) {
          // All URLs failed; generate fallback canvas
          const fallback = this.generateFallbackCanvas();
          this.canvas = fallback;
          this.loaded = true;
          resolve(fallback);
          return;
        }

        const currentUrl = candidateUrls[index];
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = currentUrl;

        img.onload = () => {
          const offscreen = document.createElement('canvas');
          offscreen.width = img.width;
          offscreen.height = img.height;
          const octx = offscreen.getContext('2d');

          if (!octx) {
            tryNextUrl(index + 1);
            return;
          }

          octx.drawImage(img, 0, 0);

          const imgData = octx.getImageData(0, 0, img.width, img.height);
          const d = imgData.data;

          // Check background pixel at (5,5)
          const bgA = d[(5 * img.width + 5) * 4 + 3];

          // Only perform chroma-keying if image has a solid opaque background (bgA === 255)
          // AND the background color is distinctly non-black (e.g. solid grey / white / green screen)
          if (bgA === 255) {
            const bgR = d[(5 * img.width + 5) * 4 + 0];
            const bgG = d[(5 * img.width + 5) * 4 + 1];
            const bgB = d[(5 * img.width + 5) * 4 + 2];

            if (bgR > 30 || bgG > 30 || bgB > 30) {
              for (let i = 0; i < d.length; i += 4) {
                if (d[i + 3] === 0) continue; // Skip already transparent pixels
                const r = d[i], g = d[i + 1], b = d[i + 2];
                const diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
                if (diff < 40) {
                  d[i + 3] = 0; // Make background transparent
                }
              }
              octx.putImageData(imgData, 0, 0);
            }
          }

          this.canvas = offscreen;
          this.loaded = true;
          resolve(offscreen);
        };

        img.onerror = () => {
          tryNextUrl(index + 1);
        };
      };

      tryNextUrl(0);
    });

    return this.loadPromise;
  }

  private generateFallbackCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 560;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, 1024, 560);

    // Draw red & blue Spider-Man silhouette on fallback canvas
    ctx.fillStyle = '#E52521';
    ctx.fillRect(20, 20, 40, 50);
    ctx.fillStyle = '#1B1E2B';
    ctx.fillRect(20, 70, 40, 40);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(30, 30, 8, 8);
    ctx.fillRect(44, 30, 8, 8);

    return canvas;
  }

  public isLoaded(): boolean {
    return this.loaded;
  }

  public getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }
}

