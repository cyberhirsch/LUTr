// GitHub App client: enough of the REST + Git Data API to read one file
// from the repo and open a pull request adding/updating a small set of
// files, with no clone and no dependency (Node's built-in fetch + crypto
// cover a JWT-signed App auth flow without a JWT library).
//
// Mirrors lensfit-server's design intent (github_app.py): a GitHub App
// scoped to exactly this repo, with only Contents: read & write and Pull
// requests: read & write -- not a personal access token, so the credential
// can be revoked without touching any personal account.
import crypto from "node:crypto";
import fs from "node:fs";

const base64url = (input) => Buffer.from(input).toString("base64url");

function signAppJwt({ appId, privateKeyPem }) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = { iat: now - 60, exp: now + 9 * 60, iss: appId }; // GitHub's own clock skew allowance is 60s; 9 min keeps well under the 10 min cap
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsigned), privateKeyPem).toString("base64url");
  return `${unsigned}.${signature}`;
}

export class GitHubAppError extends Error {}

export class GitHubAppClient {
  constructor({ appId, installationId, privateKeyPem, repo, apiBase = "https://api.github.com" }) {
    this.appId = appId;
    this.installationId = installationId;
    this.privateKeyPem = privateKeyPem;
    this.repo = repo; // "owner/name"
    this.apiBase = apiBase;
    this._installationToken = null;
    this._installationTokenExpiresAt = 0;
  }

  static fromEnv() {
    const { GITHUB_APP_ID, GITHUB_APP_INSTALLATION_ID, GITHUB_APP_PRIVATE_KEY_PATH, LUTR_REPO } = process.env;
    if (!GITHUB_APP_ID || !GITHUB_APP_INSTALLATION_ID || !GITHUB_APP_PRIVATE_KEY_PATH || !LUTR_REPO) {
      throw new GitHubAppError("Missing GITHUB_APP_ID / GITHUB_APP_INSTALLATION_ID / GITHUB_APP_PRIVATE_KEY_PATH / LUTR_REPO");
    }
    return new GitHubAppClient({
      appId: GITHUB_APP_ID,
      installationId: GITHUB_APP_INSTALLATION_ID,
      privateKeyPem: fs.readFileSync(GITHUB_APP_PRIVATE_KEY_PATH, "utf8"),
      repo: LUTR_REPO,
    });
  }

  async _installationAccessToken() {
    if (this._installationToken && Date.now() < this._installationTokenExpiresAt) return this._installationToken;
    const jwt = signAppJwt({ appId: this.appId, privateKeyPem: this.privateKeyPem });
    const response = await fetch(`${this.apiBase}/app/installations/${this.installationId}/access_tokens`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, Accept: "application/vnd.github+json" },
    });
    if (!response.ok) throw new GitHubAppError(`Could not mint installation token: ${response.status} ${await response.text()}`);
    const body = await response.json();
    this._installationToken = body.token;
    this._installationTokenExpiresAt = Date.parse(body.expires_at) - 30_000; // refresh a little early
    return this._installationToken;
  }

  async _request(method, path, body) {
    const token = await this._installationAccessToken();
    const response = await fetch(`${this.apiBase}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new GitHubAppError(`${method} ${path} -> ${response.status}: ${await response.text()}`);
    }
    return response.status === 204 ? null : response.json();
  }

  // Returns { text, sha } -- the sha is the blob sha, needed if you intend
  // to build a follow-up commit against this exact version of the file.
  async getFileText(path, ref = "main") {
    const data = await this._request("GET", `/repos/${this.repo}/contents/${path}?ref=${encodeURIComponent(ref)}`);
    return { text: Buffer.from(data.content, "base64").toString("utf8"), sha: data.sha };
  }

  // Opens a PR containing exactly the given files (added or modified),
  // built entirely through the Git Data API -- no working tree, no clone.
  // files: [{ path, content: Buffer|string, encoding: "utf-8"|"base64" }]
  async openMultiFilePr({ baseBranch, newBranch, files, commitMessage, prTitle, prBody }) {
    const baseRef = await this._request("GET", `/repos/${this.repo}/git/ref/heads/${baseBranch}`);
    const baseCommitSha = baseRef.object.sha;
    const baseCommit = await this._request("GET", `/repos/${this.repo}/git/commits/${baseCommitSha}`);

    const treeEntries = [];
    for (const file of files) {
      const content = Buffer.isBuffer(file.content) ? file.content.toString("base64") : file.content;
      const encoding = Buffer.isBuffer(file.content) ? "base64" : (file.encoding || "utf-8");
      const blob = await this._request("POST", `/repos/${this.repo}/git/blobs`, { content, encoding });
      treeEntries.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
    }

    const tree = await this._request("POST", `/repos/${this.repo}/git/trees`, {
      base_tree: baseCommit.tree.sha,
      tree: treeEntries,
    });
    const commit = await this._request("POST", `/repos/${this.repo}/git/commits`, {
      message: commitMessage,
      tree: tree.sha,
      parents: [baseCommitSha],
    });
    await this._request("POST", `/repos/${this.repo}/git/refs`, {
      ref: `refs/heads/${newBranch}`,
      sha: commit.sha,
    });
    const pr = await this._request("POST", `/repos/${this.repo}/pulls`, {
      title: prTitle,
      body: prBody,
      head: newBranch,
      base: baseBranch,
    });
    return pr.html_url;
  }
}
