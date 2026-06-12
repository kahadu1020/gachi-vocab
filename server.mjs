import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const lanMode = args.includes("--lan");
const hostFlagIndex = args.indexOf("--host");
const hostArg = hostFlagIndex >= 0 ? args[hostFlagIndex + 1] : "";
const portArg = args.find((arg) => /^\d+$/.test(arg));
const requestedPort = Number(process.env.PORT || portArg || 4173);
const host = hostArg || process.env.HOST || (lanMode ? "0.0.0.0" : "127.0.0.1");
const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
]);

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${host}`);
    const requestPath = path.normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, "");
    let filePath = path.join(root, requestPath || "index.html");

    if (!filePath.startsWith(root)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    const fileStat = await stat(filePath).catch(() => undefined);
    if (fileStat?.isDirectory()) filePath = path.join(filePath, "index.html");

    const content = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": types.get(path.extname(filePath)) || "application/octet-stream",
    });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});

server.listen(requestedPort, host, () => {
  console.log(`ガチ英単語: http://${host}:${requestedPort}/`);
  if (host === "0.0.0.0") {
    for (const address of getLanAddresses()) {
      console.log(`スマホ用: http://${address}:${requestedPort}/`);
    }
  }
});

function getLanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((info) => info && info.family === "IPv4" && !info.internal)
    .map((info) => info.address);
}
