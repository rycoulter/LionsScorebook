import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const appJs = readFileSync(join(rootDir, "app.js"), "utf8");
const indexHtml = readFileSync(join(rootDir, "index.html"), "utf8");
const serviceWorkerJs = readFileSync(join(rootDir, "service-worker.js"), "utf8");
const notFoundPath = join(rootDir, "404.html");
const notFoundHtml = readFileSync(notFoundPath, "utf8");

function mustMatch(source, pattern, label) {
  assert.match(source, pattern, label);
}

function functionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} should exist`);
  const nextFunction = source.indexOf("\nfunction ", start + 1);
  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction);
}

assert.equal(existsSync(notFoundPath), true, "404.html should exist for GitHub Pages deep links");

mustMatch(appJs, /const VIEW_ROUTES = \{[\s\S]*archive:\s*"\/archive"/, "Canonical routes should include Archive");
mustMatch(appJs, /const VIEW_ROUTES = \{[\s\S]*highlights:\s*"\/highlights"/, "Canonical routes should include Highlights");
mustMatch(appJs, /const ROUTE_VIEW_ALIASES = \{[\s\S]*"\/archive":\s*"archive"/, "Route aliases should map Archive");
mustMatch(appJs, /const ROUTE_VIEW_ALIASES = \{[\s\S]*"\/highlights":\s*"highlights"/, "Route aliases should map Highlights");
mustMatch(functionBody(appJs, "routeViewFromLocation"), /URLSearchParams[\s\S]*route/, "Route parser should support the GitHub Pages route query fallback");
mustMatch(functionBody(appJs, "updateBrowserRouteForView"), /history\[method\]\(\{ view \}, "", route\)/, "Route updates should use the browser history API");
mustMatch(functionBody(appJs, "switchView"), /updateBrowserRouteForView\(nextView/, "switchView should push route changes");
mustMatch(appJs, /window\.addEventListener\("popstate"[\s\S]*switchView\(routeViewFromLocation\(\), \{ updateRoute: false \}\)/, "Browser back/forward should restore the routed view");

mustMatch(indexHtml, /data-view="archive"/, "Archive tab should remain available");
mustMatch(indexHtml, /data-view="highlights"/, "Highlights tab should be available");
mustMatch(notFoundHtml, /params\.set\("route", route\)/, "404 fallback should preserve the requested path as route");
mustMatch(notFoundHtml, /window\.location\.replace\("\/\?"/, "404 fallback should redirect to the app shell");
mustMatch(serviceWorkerJs, /"\.\/404\.html"/, "Service worker should cache 404.html");
mustMatch(serviceWorkerJs, /caches\.match\("\.\/index\.html"\)\.then\(\(cached\) => cached \|\| response\)/, "Navigation fetches should fall back to the app shell on non-OK responses");

console.log("Page route checks passed.");
