const vertexSource = `#version 300 es
in vec2 position;
out vec2 uv;
void main() {
  uv = position * .5 + .5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const fragmentSource = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D sourceImage;
uniform sampler2D lutAtlas;
uniform int lutSize;
uniform int atlasWidth;
in vec2 uv;
out vec4 color;

vec3 readLut(ivec3 p) {
  int index = p.r + lutSize * p.g + lutSize * lutSize * p.b;
  ivec2 atlasPosition = ivec2(index % atlasWidth, index / atlasWidth);
  return texelFetch(lutAtlas, atlasPosition, 0).rgb;
}

void main() {
  vec4 source = texture(sourceImage, vec2(uv.x, 1.0 - uv.y));
  vec3 point = clamp(source.rgb, 0.0, 1.0) * float(lutSize - 1);
  ivec3 lower = ivec3(floor(point));
  ivec3 upper = min(lower + 1, ivec3(lutSize - 1));
  vec3 mixAmount = fract(point);
  vec3 c00 = mix(readLut(ivec3(lower.r, lower.g, lower.b)), readLut(ivec3(upper.r, lower.g, lower.b)), mixAmount.r);
  vec3 c10 = mix(readLut(ivec3(lower.r, upper.g, lower.b)), readLut(ivec3(upper.r, upper.g, lower.b)), mixAmount.r);
  vec3 c01 = mix(readLut(ivec3(lower.r, lower.g, upper.b)), readLut(ivec3(upper.r, lower.g, upper.b)), mixAmount.r);
  vec3 c11 = mix(readLut(ivec3(lower.r, upper.g, upper.b)), readLut(ivec3(upper.r, upper.g, upper.b)), mixAmount.r);
  color = vec4(mix(mix(c00, c10, mixAmount.g), mix(c01, c11, mixAmount.g), mixAmount.b), source.a);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || "Shader compilation failed");
  }
  return shader;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load ${url}`));
    image.src = url;
  });
}

export class LutRenderer {
  constructor() {
    this.canvas = document.createElement("canvas");
    const gl = this.canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error("WebGL 2 is required for client-side LUT previews");
    this.gl = gl;
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || "Shader linking failed");
    }
    this.program = program;
    this.sourceTexture = gl.createTexture();
    this.lutTexture = gl.createTexture();
    this.cache = new Map();
    gl.useProgram(program);
    const position = gl.getAttribLocation(program, "position");
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1i(gl.getUniformLocation(program, "sourceImage"), 0);
    gl.uniform1i(gl.getUniformLocation(program, "lutAtlas"), 1);
  }

  image(url) {
    if (!this.cache.has(url)) this.cache.set(url, loadImage(url));
    return this.cache.get(url);
  }

  async render(source, lutUrl, lutSize, target, maxWidth = 1600) {
    const sourceImage = typeof source === "string" ? await this.image(source) : source;
    const lutImage = await this.image(lutUrl);
    const scale = Math.min(1, maxWidth / sourceImage.naturalWidth);
    const width = Math.max(1, Math.round(sourceImage.naturalWidth * scale));
    const height = Math.max(1, Math.round(sourceImage.naturalHeight * scale));
    const { gl } = this;
    this.canvas.width = target.width = width;
    this.canvas.height = target.height = height;
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceImage);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.lutTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, lutImage);
    gl.uniform1i(gl.getUniformLocation(this.program, "lutSize"), lutSize);
    gl.uniform1i(gl.getUniformLocation(this.program, "atlasWidth"), lutImage.naturalWidth);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    const context = target.getContext("2d");
    context.clearRect(0, 0, width, height);
    context.drawImage(this.canvas, 0, 0);
  }
}
