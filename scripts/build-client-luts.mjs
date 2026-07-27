import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const site = path.join(root, "site");
const catalog = JSON.parse(fs.readFileSync(path.join(site, "data", "catalog.json"), "utf8"));
const outputDir = path.join(site, "assets", "luts");
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const force = process.argv.includes("--force");
const level = 5;
const concurrency = Math.max(1, Math.min(8, Number(process.env.LUTR_CLIENT_LUT_CONCURRENCY || 4)));

fs.mkdirSync(outputDir, { recursive: true });

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, {
      cwd: root,
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-5000); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr)));
  });
}

function safeFilterPath(file) {
  return path.relative(root, file).replaceAll("\\", "/").replaceAll("'", "\\'");
}

async function build(lut) {
  const output = path.join(outputDir, `${lut.id}.png`);
  if (!force && fs.existsSync(output) && fs.statSync(output).size > 0) return;
  const source = path.join(root, ...lut.sourceFile.split("/"));
  const common = ["-y", "-v", "error", "-f", "lavfi", "-i", `haldclutsrc=level=${level}`];
  if (lut.previewType === "hald") {
    await run([
      ...common, "-i", source,
      "-filter_complex", "[0:v][1:v]haldclut=interp=tetrahedral,format=rgb24",
      "-frames:v", "1", "-update", "1", output,
    ]);
  } else {
    const filterName = lut.previewType === "lut1d" ? "lut1d" : "lut3d";
    const interpolation = lut.previewType === "lut1d" ? "linear" : "tetrahedral";
    await run([
      ...common,
      "-vf", `${filterName}=file='${safeFilterPath(source)}':interp=${interpolation},format=rgb24`,
      "-frames:v", "1", "-update", "1", output,
    ]);
  }
}

const jobs = catalog.luts.filter((lut) => lut.clientLut);
let cursor = 0;
let done = 0;
const failures = [];

async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= jobs.length) return;
    const lut = jobs[index];
    try {
      await build(lut);
    } catch (error) {
      failures.push({ id: lut.id, error: String(error.message || error) });
    }
    done += 1;
    if (done % 50 === 0 || done === jobs.length) {
      console.log(`CLIENT_LUTS ${done}/${jobs.length} failed=${failures.length}`);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
fs.writeFileSync(
  path.join(site, "data", "client-lut-report.json"),
  JSON.stringify({ total: jobs.length, failed: failures.length, failures }, null, 2),
);
console.log(`DONE total=${jobs.length} failed=${failures.length}`);
if (failures.length) process.exitCode = 1;
