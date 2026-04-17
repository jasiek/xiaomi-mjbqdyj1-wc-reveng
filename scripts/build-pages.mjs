import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const staticDir = new URL('static/', root);
const outDir = new URL('dist/pages/', root);

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

for (const file of ['app.js', 'printer-web-bluetooth.js', 'styles.css']) {
  await cp(new URL(file, staticDir), new URL(file, outDir));
}

let html = await readFile(new URL('index.html', staticDir), 'utf8');
html = html
  .replace('href="/static/styles.css"', 'href="./styles.css"')
  .replace('src="/static/app.js"', 'src="./app.js"')
  .replace('<body>', '<body data-static-only="true">')
  .replace(
    '<button id="btnConnectBackend" title="Connect to the printer via the backend">Connect via backend</button>',
    '<button id="btnConnectBackend" title="Connect to the printer via the backend" hidden>Connect via backend</button>',
  )
  .replace(
    '<div class="connection-state" id="backendState">Backend printer: disconnected</div>',
    '<div class="connection-state" id="backendState" hidden>Backend printer: disconnected</div>',
  );

await writeFile(new URL('index.html', outDir), html);
