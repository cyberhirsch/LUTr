// Local receiver for the freshluts import.
//
// The browser tab holds the authenticated session; this server only accepts
// what that tab sends and writes it to disk. No credentials are handled here.
//
//   node scripts/freshluts-sink.mjs [--port 4199]
//
// Endpoints (all CORS-open to http://localhost and https://freshluts.com):
//   POST /meta   { id, ... }        -> appends one record to raw/index.ndjson
//   POST /cube   ?id=&filename=     -> writes raw/cubes/<id>__<filename>
//   GET  /status                    -> { metas, cubes }

import fs from "node:fs";
import path from "node:path";
import http from "node:http";

const root = process.cwd();
const outDir = path.join(root, "submissions-raw", "freshluts");
const cubeDir = path.join(outDir, "cubes");
fs.mkdirSync(cubeDir, { recursive: true });

const indexFile = path.join(outDir, "index.ndjson");
const portArg = process.argv.indexOf("--port");
const port = portArg > -1 ? Number(process.argv[portArg + 1]) : 4199;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function body(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const safe = (s) => String(s || "").replace(/[^\w.\- ]+/g, "_").slice(0, 120);

let metas = 0;
let cubes = 0;

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return res.writeHead(204, cors).end();

  const url = new URL(req.url, `http://localhost:${port}`);

  if (req.method === "GET" && url.pathname === "/status") {
    res.writeHead(200, { ...cors, "Content-Type": "application/json" });
    return res.end(JSON.stringify({ metas, cubes, outDir }));
  }

  if (req.method === "POST" && url.pathname === "/meta") {
    const raw = (await body(req)).toString("utf8");
    fs.appendFileSync(indexFile, raw.replace(/\s*$/, "") + "\n", "utf8");
    metas += 1;
    if (metas % 25 === 0) console.log(`meta ${metas}`);
    res.writeHead(200, cors);
    return res.end("ok");
  }

  if (req.method === "POST" && url.pathname === "/cube") {
    const id = safe(url.searchParams.get("id"));
    const filename = safe(url.searchParams.get("filename") || "lut.cube");
    const buf = await body(req);
    fs.writeFileSync(path.join(cubeDir, `${id}__${filename}`), buf);
    cubes += 1;
    console.log(`cube ${cubes}: ${id} ${filename} (${(buf.length / 1024).toFixed(0)} KB)`);
    res.writeHead(200, cors);
    return res.end("ok");
  }

  res.writeHead(404, cors);
  res.end("not found");
});

server.listen(port, "127.0.0.1", () => {
  console.log(`freshluts sink listening on http://127.0.0.1:${port}`);
  console.log(`writing to ${outDir}`);
});
