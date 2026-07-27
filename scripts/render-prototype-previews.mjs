import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const site = path.join(root, "site");
const catalog = JSON.parse(fs.readFileSync(path.join(site, "data", "catalog.json"), "utf8"));
const imageBuild = JSON.parse(fs.readFileSync(path.join(site, "data", "images-build.json"), "utf8"));
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const force = process.argv.includes("--force");
const requestedConcurrency = Number(process.env.LUTR_RENDER_CONCURRENCY || 6);
const concurrency = Number.isFinite(requestedConcurrency) ? Math.max(1, Math.min(12, requestedConcurrency)) : 6;

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, { cwd: root, windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let errorText = "";
    child.stderr.on("data", (chunk) => {
      errorText += chunk.toString();
      if (errorText.length > 12000) errorText = errorText.slice(-12000);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${errorText.slice(-2000)}`));
    });
  });
}

async function renderBase(image) {
  const output = path.join(site, "assets", "images", `${image.id}.webp`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  if (!force && fs.existsSync(output) && fs.statSync(output).size > 0) return output;
  const input = path.join(root, ...image.sourceFile.split("/"));
  const filter = image.proxyMode === "linear"
    ? "format=gbrpf32le,tonemap=tonemap=hable:desat=0,zscale=transferin=linear:primariesin=bt709:matrixin=gbr:transfer=bt709:primaries=bt709:matrix=bt709:range=full,scale=960:-2:flags=lanczos,format=yuv420p"
    : "scale=960:-2:flags=lanczos,format=yuv420p";
  await run(["-y", "-v", "error", "-i", input, "-vf", filter, "-frames:v", "1", "-c:v", "libwebp", "-quality", "82", output]);
  return output;
}

function safeFilterPath(file) {
  return path.relative(root, file).replaceAll("\\", "/").replaceAll("'", "\\'");
}

async function renderPreview(job) {
  const output = path.join(site, "assets", "previews", job.image.id, `${job.lut.id}.webp`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  if (!force && fs.existsSync(output) && fs.statSync(output).size > 0) return;
  const source = path.join(site, "assets", "images", `${job.image.id}.webp`);
  const lutFile = path.join(root, ...job.lut.sourceFile.split("/"));
  if (job.lut.previewType === "lut3d") {
    const filter = `lut3d=file='${safeFilterPath(lutFile)}':interp=tetrahedral,scale=560:-2:flags=lanczos,format=yuv420p`;
    await run(["-y", "-v", "error", "-i", source, "-vf", filter, "-frames:v", "1", "-c:v", "libwebp", "-quality", "68", output]);
  } else if (job.lut.previewType === "lut1d") {
    const filter = `lut1d=file='${safeFilterPath(lutFile)}':interp=linear,scale=560:-2:flags=lanczos,format=yuv420p`;
    await run(["-y", "-v", "error", "-i", source, "-vf", filter, "-frames:v", "1", "-c:v", "libwebp", "-quality", "68", output]);
  } else if (job.lut.previewType === "hald") {
    const filter = "[0:v][1:v]haldclut=interp=tetrahedral,scale=560:-2:flags=lanczos,format=yuv420p";
    await run(["-y", "-v", "error", "-i", source, "-i", lutFile, "-filter_complex", filter, "-frames:v", "1", "-c:v", "libwebp", "-quality", "68", output]);
  }
}

for (const image of imageBuild) {
  await renderBase(image);
  console.log(`BASE ${image.id}`);
}

const previewable = catalog.luts.filter((lut) => lut.previewType);
const jobs = imageBuild.flatMap((image) => previewable.map((lut) => ({ image, lut })));
let cursor = 0;
let completed = 0;
let failed = 0;
const failures = [];

async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= jobs.length) return;
    const job = jobs[index];
    try {
      await renderPreview(job);
    } catch (error) {
      failed += 1;
      failures.push({ image: job.image.id, lut: job.lut.id, error: String(error.message || error) });
    }
    completed += 1;
    if (completed % 100 === 0 || completed === jobs.length) {
      console.log(`PROGRESS ${completed}/${jobs.length} failed=${failed}`);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

const expectedByImage = new Map(imageBuild.map((image) => [
  image.id,
  new Set(previewable.map((lut) => `${lut.id}.webp`)),
]));
for (const [imageId, expected] of expectedByImage) {
  const dir = path.join(site, "assets", "previews", imageId);
  if (!fs.existsSync(dir)) continue;
  for (const filename of fs.readdirSync(dir)) {
    if (filename.endsWith(".webp") && !expected.has(filename)) {
      fs.rmSync(path.join(dir, filename));
    }
  }
}

const report = { total: jobs.length, completed, failed, failures };
fs.writeFileSync(path.join(site, "data", "render-report.json"), JSON.stringify(report, null, 2), "utf8");
console.log(`DONE total=${jobs.length} failed=${failed}`);
if (failed) process.exitCode = 1;
