/**
 * spritebatch-renderer.ts — WebGPU SpriteBatch Renderer implementation.
 * Encapsulates RenderSurface, SpriteBatch, and Texture2D for GPU-accelerated sprite rendering.
 * Uses dynamic module loading so WebGPU failure never breaks the 2D canvas pet rendering.
 */

import { POSES, type FramePose } from '../sprite-poses.js';
import { SpriteSheetLoader } from '../loader.js';
import type { DrawOptions, PoseName } from '../sprite.js';

let RenderSurface: any = null;
let SpriteBatch: any = null;
let Texture2D: any = null;
let SamplerState: any = null;
let BlendState: any = null;

export class WebGPUSpriteRenderer {
  private surface: any = null;
  private batch: any = null;
  private texture: any = null;
  private isInitialized = false;

  public static async isSupported(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
      return false;
    }
    try {
      const adapter = await (navigator as any).gpu?.requestAdapter();
      return !!adapter;
    } catch {
      return false;
    }
  }

  public async init(canvas: HTMLCanvasElement): Promise<boolean> {
    try {
      if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
        return false;
      }
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (!adapter) return false;

      // Dynamic import prevents static bare-module resolution errors from breaking main thread
      const sbModule = await import('webgpu-spritebatch');
      RenderSurface = sbModule.RenderSurface;
      SpriteBatch = sbModule.SpriteBatch;
      Texture2D = sbModule.Texture2D;
      SamplerState = sbModule.SamplerState;
      BlendState = sbModule.BlendState;

      this.surface = await RenderSurface.create(canvas);

      // Force alphaMode: "premultiplied" so WebGPU canvas overlay is transparent
      const ctx = (this.surface as any)._context;
      if (ctx && typeof ctx.configure === 'function') {
        const origConfigure = ctx.configure.bind(ctx);
        ctx.configure = (config: any) => {
          origConfigure({
            ...config,
            alphaMode: 'premultiplied',
          });
        };
        ctx.configure({
          device: this.surface.gpuDevice,
          format: this.surface.format,
          alphaMode: 'premultiplied',
        });
      }

      this.batch = new SpriteBatch(this.surface);

      const spriteCanvas = await SpriteSheetLoader.getInstance().load();
      if (spriteCanvas) {
        // Convert offscreen 2D canvas (edited via putImageData) to GPU ImageBitmap for proper WebGPU texture copy
        const imageBitmap = await createImageBitmap(spriteCanvas);
        this.texture = Texture2D.fromImageSource(this.surface, imageBitmap);
      }

      this.isInitialized = true;
      console.log('⚡ [WebGPU] SpriteBatch renderer initialized with ImageBitmap texture.');
      return true;
    } catch (err) {
      console.warn('⚠️ [WebGPU] SpriteBatch init failed, using 2D canvas fallback:', err);
      this.isInitialized = false;
      return false;
    }
  }

  public get active(): boolean {
    return this.isInitialized && !!this.surface && !!this.batch && !!this.texture;
  }

  public beginFrame(): void {
    if (!this.active || !this.surface || !this.batch) return;
    this.surface.beginFrame({ clearColor: { r: 0, g: 0, b: 0, a: 0 } });

    // Intercept commandEncoder.beginRenderPass to set loadOp: "clear" for absolute 1-frame rendering (zero ghost trails)
    const encoder = this.surface.commandEncoder;
    if (encoder && !(encoder as any).__patched) {
      (encoder as any).__patched = true;
      const origBeginPass = encoder.beginRenderPass.bind(encoder);
      encoder.beginRenderPass = (descriptor: GPURenderPassDescriptor) => {
        if (descriptor && descriptor.colorAttachments && descriptor.colorAttachments[0]) {
          const colorAtt = descriptor.colorAttachments[0] as any;
          colorAtt.loadOp = 'clear';
          colorAtt.clearValue = { r: 0, g: 0, b: 0, a: 0 };
        }
        return origBeginPass(descriptor);
      };
    }

    this.batch.begin({
      samplerState: SamplerState.pointClamp,
      blendState: BlendState.premultipliedAlpha,
    });
  }

  public drawSpidey(
    poseName: PoseName,
    x: number,
    y: number,
    scale: number,
    opts: DrawOptions = {}
  ): void {
    if (!this.active || !this.batch || !this.texture) return;
    const p: FramePose = POSES[poseName] || POSES.IDLE;
    if (!p) return;

    const eyeOffsetX = Math.round((opts.eyeDX ?? 0) * 1.5);
    const eyeOffsetY = Math.round((opts.eyeDY ?? 0) * 0.8);
    const posX = Math.round(x) + eyeOffsetX;
    const posY = Math.round(y) + eyeOffsetY;

    const squashY = opts.squashY ?? 1;

    this.batch.draw(this.texture, {
      position: [posX, posY],
      sourceRect: { x: p.x, y: p.y, width: p.w, height: p.h },
      scale: [scale, scale * squashY],
      origin: [p.w * p.anchorX, p.h * p.anchorY],
      rotation: opts.rotation || 0,
      flip: opts.flip ? 'horizontal' : 'none',
    });
  }

  public endFrame(): void {
    if (!this.active || !this.surface || !this.batch) return;
    this.batch.end();
    this.surface.endFrame();
  }

  public resize(): void {
    if (this.surface) {
      this.surface.resize();
    }
  }

  public destroy(): void {
    if (this.texture) {
      this.texture.destroy();
      this.texture = null;
    }
    this.batch = null;
    this.surface = null;
    this.isInitialized = false;
  }
}
