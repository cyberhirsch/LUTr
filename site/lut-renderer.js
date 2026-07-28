import { colorSpace, conversionMatrix, glMatrix } from "./color-spaces.js";
import { parseCube, sampleLut } from "./lut-io.js";

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
uniform int sourceTransfer;
uniform int lutInputTransfer;
uniform int lutOutputTransfer;
uniform int displayTransfer;
uniform mat3 sourceToLut;
uniform mat3 lutToDisplay;
uniform bool applyLut;
uniform bool sourceFlipY;
in vec2 uv;
out vec4 color;

vec3 readLut(ivec3 p) {
  int index = p.r + lutSize * p.g + lutSize * lutSize * p.b;
  ivec2 atlasPosition = ivec2(index % atlasWidth, index / atlasWidth);
  return texelFetch(lutAtlas, atlasPosition, 0).rgb;
}

float signedPower(float value, float exponent) {
  return sign(value) * pow(abs(value), exponent);
}

float decodeValue(float value, int transfer) {
  if (transfer == 0) return value;
  if (transfer == 1) return value <= 0.04045 ? value / 12.92 : pow((value + 0.055) / 1.055, 2.4);
  if (transfer == 2) return value < 0.081 ? value / 4.5 : pow((value + 0.099) / 1.099, 1.0 / 0.45);
  if (transfer == 3) return signedPower(value, 2.4);
  if (transfer == 4) {
    float cut = 171.2102946929 / 1023.0;
    return value >= cut
      ? pow(10.0, (value * 1023.0 - 420.0) / 261.5) * 0.19 - 0.01
      : (value * 1023.0 - 95.0) * 0.01125 / (171.2102946929 - 95.0);
  }
  if (transfer == 5) return value > 0.1496582
    ? (pow(10.0, (value - 0.385537) / 0.24719) - 0.052272) / 5.555556
    : (value - 0.092809) / 5.367655;
  if (transfer == 6) return value < 0.181
    ? (value - 0.125) / 5.6
    : pow(10.0, (value - 0.598206) / 0.241514) - 0.00873;
  if (transfer == 7) return (pow(10.0, (value - 0.616596 - 0.03) / 0.432699) - 0.037584) / 4.5;
  if (transfer == 8) return pow(10.0, (value - 0.616596 - 0.03) / 0.432699) - 0.037584;
  if (transfer == 9) return max(0.0, pow(10.0, (value - 0.53) / 0.38) - 0.01);
  if (transfer == 10) return value < 0.0928 ? (value - 0.0928) / 4.5 : pow(10.0, (value - 0.456) / 0.224) - 0.005;
  if (transfer == 11) return signedPower((value - 0.035) / 0.965, 2.2);
  if (transfer == 12) return pow(10.0, (value - 0.4) / 0.3) - 0.01;
  if (transfer == 13) return pow(10.0, (value - 0.38) / 0.28) - 0.01;
  if (transfer == 14) return pow(10.0, (value - 0.4) / 0.32) - 0.01;
  if (transfer == 15) return pow(10.0, (value - 0.685) / 0.2471896) - 0.01;
  if (transfer == 16) return signedPower(value, 2.4);
  if (transfer == 17) return signedPower(value, 2.2);
  if (transfer == 18) return signedPower(value, 1.8);
  if (transfer == 19) return signedPower(value, 2.2);
  if (transfer == 20) return sign(value - 0.4) * (pow(2.0, 12.0 * abs(value - 0.4)) - 1.0) / 64.0;
  if (transfer == 21) {
    float linearBreak = -0.0180569961199113;
    float encodedBreak = 0.0647954196341293 * log2(2231.82630906769 * linearBreak + 64.0) - 0.295908392682586;
    return value > encodedBreak
      ? (pow(2.0, (value + 0.295908392682586) / 0.0647954196341293) - 64.0) / 2231.82630906769
      : (value - encodedBreak) / 8.803033210537 + linearBreak;
  }
  if (transfer == 22) return value >= 0.133883
    ? exp((value - 0.530013) / 0.0869288) - 0.00549407
    : (value - 0.0924658) / 8.2836059;
  if (transfer == 23) return value > 0.02740668
    ? exp2(value * 14.0 - 7.0) - 0.0075
    : value / 10.44426855;
  if (transfer == 24) return sign(value - 0.333) * (pow(10.0, abs(value - 0.333) / 0.224282) - 1.0) / 64.0;
  return value;
}

float encodeValue(float value, int transfer) {
  if (transfer == 0) return value;
  if (transfer == 1) return value <= 0.0031308 ? 12.92 * value : 1.055 * signedPower(value, 1.0 / 2.4) - 0.055;
  if (transfer == 2) return value < 0.018 ? 4.5 * value : 1.099 * signedPower(value, 0.45) - 0.099;
  if (transfer == 3) return signedPower(value, 1.0 / 2.4);
  if (transfer == 4) return value >= 0.01125
    ? (420.0 + log((value + 0.01) / 0.19) / log(10.0) * 261.5) / 1023.0
    : (value * (171.2102946929 - 95.0) / 0.01125 + 95.0) / 1023.0;
  if (transfer == 5) return value > 0.010591
    ? 0.24719 * log(5.555556 * value + 0.052272) / log(10.0) + 0.385537
    : 5.367655 * value + 0.092809;
  if (transfer == 6) return value < 0.01
    ? 5.6 * value + 0.125
    : 0.241514 * log(value + 0.00873) / log(10.0) + 0.598206;
  if (transfer == 7) return 0.432699 * log(4.5 * value + 0.037584) / log(10.0) + 0.646596;
  if (transfer == 8) return 0.432699 * log(value + 0.037584) / log(10.0) + 0.646596;
  if (transfer == 9) return 0.38 * log(max(0.0, value) + 0.01) / log(10.0) + 0.53;
  if (transfer == 10) return value < 0.0 ? 4.5 * value + 0.0928 : 0.224 * log(value + 0.005) / log(10.0) + 0.456;
  if (transfer == 11) return 0.965 * signedPower(value, 1.0 / 2.2) + 0.035;
  if (transfer == 12) return 0.3 * log(value + 0.01) / log(10.0) + 0.4;
  if (transfer == 13) return 0.28 * log(value + 0.01) / log(10.0) + 0.38;
  if (transfer == 14) return 0.32 * log(value + 0.01) / log(10.0) + 0.4;
  if (transfer == 15) return 0.2471896 * log(value + 0.01) / log(10.0) + 0.685;
  if (transfer == 16) return signedPower(value, 1.0 / 2.4);
  if (transfer == 17) return signedPower(value, 1.0 / 2.2);
  if (transfer == 18) return signedPower(value, 1.0 / 1.8);
  if (transfer == 19) return signedPower(value, 1.0 / 2.2);
  if (transfer == 20) return sign(value) * log2(1.0 + 64.0 * abs(value)) / 12.0 + 0.4;
  if (transfer == 21) {
    float linearBreak = -0.0180569961199113;
    float encodedBreak = 0.0647954196341293 * log2(2231.82630906769 * linearBreak + 64.0) - 0.295908392682586;
    return value > linearBreak
      ? 0.0647954196341293 * log2(2231.82630906769 * value + 64.0) - 0.295908392682586
      : 8.803033210537 * (value - linearBreak) + encodedBreak;
  }
  if (transfer == 22) return value >= 0.005
    ? 0.0869288 * log(value + 0.00549407) + 0.530013
    : 8.2836059 * value + 0.0924658;
  if (transfer == 23) return value > 0.00262409
    ? (log2(value + 0.0075) + 7.0) / 14.0
    : value * 10.44426855;
  if (transfer == 24) return sign(value) * 0.224282 * log(1.0 + 64.0 * abs(value)) / log(10.0) + 0.333;
  return value;
}

vec3 decodeColor(vec3 value, int transfer) {
  return vec3(decodeValue(value.r, transfer), decodeValue(value.g, transfer), decodeValue(value.b, transfer));
}

vec3 encodeColor(vec3 value, int transfer) {
  return vec3(encodeValue(value.r, transfer), encodeValue(value.g, transfer), encodeValue(value.b, transfer));
}

vec3 sampleLut(vec3 encoded) {
  vec3 point = clamp(encoded, 0.0, 1.0) * float(lutSize - 1);
  ivec3 lower = ivec3(floor(point));
  ivec3 upper = min(lower + 1, ivec3(lutSize - 1));
  vec3 mixAmount = fract(point);
  vec3 c00 = mix(readLut(ivec3(lower.r, lower.g, lower.b)), readLut(ivec3(upper.r, lower.g, lower.b)), mixAmount.r);
  vec3 c10 = mix(readLut(ivec3(lower.r, upper.g, lower.b)), readLut(ivec3(upper.r, upper.g, lower.b)), mixAmount.r);
  vec3 c01 = mix(readLut(ivec3(lower.r, lower.g, upper.b)), readLut(ivec3(upper.r, lower.g, upper.b)), mixAmount.r);
  vec3 c11 = mix(readLut(ivec3(lower.r, upper.g, upper.b)), readLut(ivec3(upper.r, upper.g, upper.b)), mixAmount.r);
  return mix(mix(c00, c10, mixAmount.g), mix(c01, c11, mixAmount.g), mixAmount.b);
}

void main() {
  vec4 source = texture(sourceImage, vec2(uv.x, sourceFlipY ? 1.0 - uv.y : uv.y));
  vec3 lutDomain = encodeColor(sourceToLut * decodeColor(source.rgb, sourceTransfer), lutInputTransfer);
  vec3 transformed = applyLut ? sampleLut(lutDomain) : lutDomain;
  vec3 display = encodeColor(lutToDisplay * decodeColor(transformed, lutOutputTransfer), displayTransfer);
  color = vec4(display, source.a);
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

async function loadCube(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load ${url} (${response.status})`);
  const lut = parseCube(await response.text(), url.split("/").at(-1));
  const renderLut = lut.kind === "1D" ? (() => {
    const size = 33;
    const values = [];
    for (let b = 0; b < size; b += 1) for (let g = 0; g < size; g += 1) for (let r = 0; r < size; r += 1) {
      values.push(sampleLut(lut, [r, g, b].map((value) => value / (size - 1))));
    }
    return { ...lut, kind: "3D", size, values };
  })() : lut;
  const width = Math.min(512, renderLut.values.length);
  const height = Math.ceil(renderLut.values.length / width);
  const pixels = new Float32Array(width * height * 4);
  for (let index = 0; index < renderLut.values.length; index += 1) {
    pixels[index * 4] = renderLut.values[index][0];
    pixels[index * 4 + 1] = renderLut.values[index][1];
    pixels[index * 4 + 2] = renderLut.values[index][2];
    pixels[index * 4 + 3] = 1;
  }
  return { ...renderLut, width, height, pixels };
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
    this.lutCache = new Map();
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

  lut(url) {
    if (!this.lutCache.has(url)) this.lutCache.set(url, loadCube(url));
    return this.lutCache.get(url);
  }

  async render(source, lutUrl, lutSize, target, maxWidth = 1600, options = {}) {
    const sourceImage = typeof source === "string" ? await this.image(source) : source;
    const lut = await this.lut(lutUrl);
    return this.renderPrepared(sourceImage, lut, lut.size, target, maxWidth, options);
  }

  async renderIdentity(source, target, maxWidth = 1600, options = {}) {
    const sourceImage = typeof source === "string" ? await this.image(source) : source;
    return this.renderPrepared(sourceImage, null, 2, target, maxWidth, { ...options, applyLut: false });
  }

  renderPrepared(sourceImage, lut, lutSize, target, maxWidth, options) {
    const sourceWidth = sourceImage.naturalWidth || sourceImage.width;
    const sourceHeight = sourceImage.naturalHeight || sourceImage.height;
    const scale = Math.min(1, maxWidth / sourceWidth);
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const sourceSpace = colorSpace(options.sourceSpace || "srgb");
    const lutInputSpace = colorSpace(options.lutInputSpace || "srgb");
    const lutOutputSpace = colorSpace(options.lutOutputSpace || "srgb");
    const displaySpace = colorSpace(options.displaySpace || "srgb");
    if (!sourceSpace || !lutInputSpace || !lutOutputSpace || !displaySpace) {
      throw new Error("The image and LUT color spaces must be defined");
    }
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
    if (sourceImage.dataType === "float" && sourceImage.data instanceof Float32Array) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, sourceWidth, sourceHeight, 0, gl.RGBA, gl.FLOAT, sourceImage.data);
    } else if (sourceImage.dataType === "uint8" && ArrayBuffer.isView(sourceImage.data)) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sourceWidth, sourceHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, sourceImage.data);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceImage);
    }

    if (lut) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.lutTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, lut.width, lut.height, 0, gl.RGBA, gl.FLOAT, lut.pixels);
    }
    gl.uniform1i(gl.getUniformLocation(this.program, "lutSize"), lutSize);
    gl.uniform1i(gl.getUniformLocation(this.program, "atlasWidth"), lut?.width || 1);
    gl.uniform1i(gl.getUniformLocation(this.program, "sourceTransfer"), sourceSpace.transfer);
    gl.uniform1i(gl.getUniformLocation(this.program, "lutInputTransfer"), lutInputSpace.transfer);
    gl.uniform1i(gl.getUniformLocation(this.program, "lutOutputTransfer"), lutOutputSpace.transfer);
    gl.uniform1i(gl.getUniformLocation(this.program, "displayTransfer"), displaySpace.transfer);
    gl.uniform1i(gl.getUniformLocation(this.program, "sourceFlipY"), sourceImage.flipY === false ? 0 : 1);
    gl.uniformMatrix3fv(gl.getUniformLocation(this.program, "sourceToLut"), false, glMatrix(conversionMatrix(sourceSpace.id, lutInputSpace.id)));
    gl.uniformMatrix3fv(gl.getUniformLocation(this.program, "lutToDisplay"), false, glMatrix(conversionMatrix(lutOutputSpace.id, displaySpace.id)));
    gl.uniform1i(gl.getUniformLocation(this.program, "applyLut"), options.applyLut === false ? 0 : 1);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    const context = target.getContext("2d");
    context.clearRect(0, 0, width, height);
    context.drawImage(this.canvas, 0, 0);
  }
}
