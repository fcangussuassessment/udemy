import type { Adjustments } from "./adjustments";

const VERTEX = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = vec2((a_pos.x + 1.0) * 0.5, 1.0 - (a_pos.y + 1.0) * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// Todos os ajustes de cor/luz em uma única passada na GPU (RNF-04).
const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_image;
uniform float u_exposure, u_contrast, u_highlights, u_shadows, u_whites, u_blacks;
uniform float u_temperature, u_tint, u_vibrance, u_saturation;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
  vec4 src = texture(u_image, v_uv);
  vec3 c = pow(src.rgb, vec3(2.2));            // para linear
  c *= exp2(u_exposure);
  c *= vec3(1.0 + u_temperature * 0.25 + u_tint * 0.05, 1.0 - u_tint * 0.2, 1.0 - u_temperature * 0.25 + u_tint * 0.05);
  c = pow(max(c, 0.0), vec3(1.0 / 2.2));        // de volta para gama

  float black = -u_blacks * 0.15;
  float white = 1.0 - u_whites * 0.15;
  c = (c - black) / max(white - black, 0.05);

  float L = luma(c);
  c += u_shadows * 0.35 * (1.0 - smoothstep(0.0, 0.5, L)) * (1.0 - L);
  c += u_highlights * 0.35 * smoothstep(0.5, 1.0, L) * L;

  c = (c - 0.5) * (1.0 + u_contrast) + 0.5;

  L = luma(c);
  float sat = max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);
  c = mix(vec3(L), c, 1.0 + u_vibrance * (1.0 - sat));
  c = mix(vec3(L), c, 1.0 + u_saturation);

  outColor = vec4(clamp(c, 0.0, 1.0), src.a);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "shader");
  return shader;
}

const UNIFORMS = [
  "exposure", "contrast", "highlights", "shadows", "whites", "blacks",
  "temperature", "tint", "vibrance", "saturation",
] as const;

/** Aplica os ajustes de cor a uma imagem, gerando um canvas do mesmo tamanho. */
export class ColorRenderer {
  readonly canvas: HTMLCanvasElement | OffscreenCanvas;
  private gl: WebGL2RenderingContext;
  private locations: Record<string, WebGLUniformLocation | null> = {};
  private texture: WebGLTexture;

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas = new OffscreenCanvas(1, 1)) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, premultipliedAlpha: false }) as WebGL2RenderingContext | null;
    if (!gl) throw new Error("WebGL2 não é suportado neste navegador.");
    this.gl = gl;
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const u of UNIFORMS) this.locations[u] = gl.getUniformLocation(program, `u_${u}`);
    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  get maxTextureSize(): number {
    return this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE);
  }

  setImage(image: TexImageSource & { width: number; height: number }) {
    const gl = this.gl;
    this.canvas.width = image.width;
    this.canvas.height = image.height;
    gl.viewport(0, 0, image.width, image.height);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  }

  render(a: Adjustments) {
    const gl = this.gl;
    const values: Record<(typeof UNIFORMS)[number], number> = {
      exposure: a.exposure,
      contrast: a.contrast / 100,
      highlights: a.highlights / 100,
      shadows: a.shadows / 100,
      whites: a.whites / 100,
      blacks: a.blacks / 100,
      temperature: a.temperature / 100,
      tint: a.tint / 100,
      vibrance: a.vibrance / 100,
      saturation: a.saturation / 100,
    };
    for (const u of UNIFORMS) gl.uniform1f(this.locations[u], values[u]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  dispose() {
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

type Drawable = CanvasImageSource & { width: number; height: number };

/** Tamanho da imagem após giros de 90°. */
export function orientedSize(w: number, h: number, rotate: number) {
  return rotate % 2 ? { w: h, h: w } : { w, h };
}

/** Desenha a imagem girada, espelhada e endireitada (sem corte). */
export function drawGeometry(src: Drawable, a: Adjustments, target: HTMLCanvasElement | OffscreenCanvas) {
  const { w, h } = orientedSize(src.width, src.height, a.rotate);
  target.width = w;
  target.height = h;
  const ctx = target.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  const theta = (a.straighten * Math.PI) / 180;
  // Amplia o suficiente para que a rotação fina não deixe cantos vazios.
  const cover = Math.abs(Math.cos(theta)) + (Math.max(w, h) / Math.min(w, h)) * Math.abs(Math.sin(theta));
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate((a.rotate * Math.PI) / 2 + theta);
  ctx.scale(a.flipH ? -cover : cover, cover);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  ctx.restore();
}

/** Pipeline completo: cor (GPU) → geometria → corte. */
export function renderFull(
  renderer: ColorRenderer,
  src: Drawable & TexImageSource,
  a: Adjustments,
): OffscreenCanvas {
  renderer.setImage(src);
  renderer.render(a);
  const oriented = new OffscreenCanvas(1, 1);
  drawGeometry(renderer.canvas, a, oriented);
  const cw = Math.max(1, Math.round(a.crop.w * oriented.width));
  const ch = Math.max(1, Math.round(a.crop.h * oriented.height));
  const out = new OffscreenCanvas(cw, ch);
  out.getContext("2d")!.drawImage(oriented, a.crop.x * oriented.width, a.crop.y * oriented.height, cw, ch, 0, 0, cw, ch);
  return out;
}
