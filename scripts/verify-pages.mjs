import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const [base, manifestPath, output] = process.argv.slice(2);
if (!base || !manifestPath || !output) throw new Error('Usage: node scripts/verify-pages.mjs base manifest output');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const checks = [];
// 平台部署配置在下载后逐文件核验；公网检查只请求实际公开资产。
const platformFiles = new Set(['_headers', '_worker.js', '_routes.json']);
for (const entry of manifest.files.filter(file => !platformFiles.has(file.path))) {
  const response = await fetch(new URL(entry.path === 'index.html' ? '/' : entry.path, base), { signal: AbortSignal.timeout(30000) });
  const bytes = Buffer.from(await response.arrayBuffer());
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  checks.push({ path: entry.path, status: response.status, contentType: response.headers.get('content-type'), sha256, pass: response.ok && sha256 === entry.sha256 });
}
const home = await fetch(base, { signal: AbortSignal.timeout(30000) });
const headers = Object.fromEntries(['content-security-policy', 'x-content-type-options', 'referrer-policy', 'x-frame-options', 'permissions-policy', 'cache-control'].map(key => [key, home.headers.get(key)]));
const headerPass = headers['content-security-policy']?.includes("frame-ancestors 'none'") && headers['x-content-type-options'] === 'nosniff' && headers['referrer-policy'] === 'no-referrer' && headers['x-frame-options'] === 'DENY' && headers['permissions-policy']?.includes('camera=()');
const missing = await fetch(new URL('/private-nonexistent-deployment-check', base), { signal: AbortSignal.timeout(30000) });
const receipt = { schema: 'inspiration-pages-verification/v1', checkedAt: new Date().toISOString(), base, packageHash: manifest.packageHash, files: checks, headers, headerPass: Boolean(headerPass), missingPathStatus: missing.status, pass: checks.every(check => check.pass) && headerPass && missing.status === 404 };
await writeFile(output, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
if (!receipt.pass) process.exitCode = 1;
