import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const STANDINGS_URL = process.env.PITTSBURGH_NABA_STANDINGS_URL
  || "https://www.pittsburghnaba.org/teams/default.asp?p=standings&s=baseball&u=PITTSBURGHNABA";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const LEAGUE_SEASON = Number(process.env.LEAGUE_SEASON) || new Date().getFullYear();
const STANDINGS_JSON_PATH = path.join("data", "league-standings.json");
const STANDINGS_SCRIPT_PATH = path.join("data", "league-standings-cache.js");

function decodeHtmlEntities(value = "") {
  return String(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanCell(value = "") {
  return decodeHtmlEntities(String(value).replace(/<[^>]*>/g, " "))
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function teamCode(name = "") {
  const words = String(name || "Team").split(/\s+/).filter(Boolean);
  return words.map((word) => word[0]).join("").slice(0, 3).toUpperCase() || "TM";
}

function slug(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeWinPct(value = "") {
  const text = String(value).trim();
  if (!text || text === "-") return "";
  if (text === "1" || text === "1.000") return "1.000";
  if (/^0?\.\d{3}$/.test(text)) return text.replace(/^0/, "");
  return text;
}

function parseAaStandingsTable(html) {
  const tableMatch = String(html || "").match(/<table\b[^>]*id=["']standingsTable["'][^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch?.[1]) return [];
  const rowMatches = [...tableMatch[1].matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi)];
  const rows = [];
  let activeDivision = "";
  for (const match of rowMatches) {
    const rowAttrs = match[1] || "";
    const rowHtml = match[2] || "";
    if (/standDiv0/i.test(rowAttrs)) {
      activeDivision = cleanCell(rowHtml).toUpperCase();
      continue;
    }
    if (activeDivision !== "AA" || !/standTeam/i.test(rowAttrs)) continue;
    const cells = [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cleanCell(cell[1]));
    if (cells.length < 10) continue;
    rows.push({
      teamName: cells[0],
      record: cells[1] || "0-0",
      points: cells[2] && cells[2] !== "-" ? Number(cells[2]) || 0 : 0,
      pointsLabel: cells[2] || "-",
      winPct: normalizeWinPct(cells[3]),
      gb: cells[4] || "-",
      rf: Number(cells[7]) || 0,
      ra: Number(cells[8]) || 0,
      last10: cells[9] || "--",
      streak: cells[10] || "--"
    });
  }
  return rows;
}

function visibleText(html = "") {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\u00a0/g, " ");
}

function parseAaStandingsText(html) {
  const text = visibleText(html).replace(/\s+/g, " ").trim();
  const aaBlockMatch = text.match(/\bAA\s+Team\s+Record\s+Pts\s+Win\s+%GB\s+Home\s+Away\s+RF\s+RA\s+Last\s+10\s+Streak\s+([\s\S]*?)(?:\s+\bA\s+Team\s+Record\s+Pts\s+Win\s+%GB|\s+PRINT\b|$)/i);
  if (!aaBlockMatch?.[1]) return [];
  const rowPattern = /(?<teamName>[A-Za-z0-9&'’:\-. ]+?)(?<record>\d+-\d+(?:-\d+)?)\s+(?<points>\d+)\s+(?<winPct>1\.000|\.\d{3})\s+(?<gb>-|\d+(?:\.\d+)?)\s+(?<home>\d+-\d+(?:-\d+)?)\s+(?<away>\d+-\d+(?:-\d+)?)\s+(?<rf>\d+)\s+(?<ra>\d+)\s+(?<last10>\d+-\d+(?:-\d+)?)\s+(?<streak>(?:Won|Lost|Tied)\s+\d+)/gi;
  return [...aaBlockMatch[1].matchAll(rowPattern)].map((match) => ({
    teamName: match.groups.teamName.trim(),
    record: match.groups.record,
    points: Number(match.groups.points) || 0,
    pointsLabel: match.groups.points,
    winPct: normalizeWinPct(match.groups.winPct),
    gb: match.groups.gb,
    rf: Number(match.groups.rf) || 0,
    ra: Number(match.groups.ra) || 0,
    last10: match.groups.last10,
    streak: match.groups.streak
  }));
}

function parseAaStandings(html) {
  const tableRows = parseAaStandingsTable(html);
  const rows = tableRows.length ? tableRows : parseAaStandingsText(html);
  if (!rows.length) {
    throw new Error("Unable to parse AA standings rows from the Pittsburgh NABA response.");
  }
  return rows.map((row, index) => ({
    id: `${LEAGUE_SEASON}-aa-${slug(row.teamName)}`,
    rank: index + 1,
    teamName: row.teamName,
    teamCode: teamCode(row.teamName),
    record: row.record,
    points: row.points,
    pointsLabel: row.pointsLabel,
    winPct: row.winPct,
    gb: row.gb,
    rf: row.rf,
    ra: row.ra,
    last10: row.last10,
    streak: row.streak,
    sourceUrl: STANDINGS_URL,
    sourceLabel: "Pittsburgh NABA AA standings"
  }));
}

async function fetchStandingsHtml() {
  if (process.env.STANDINGS_HTML_FILE) {
    return readFile(process.env.STANDINGS_HTML_FILE, "utf8");
  }
  const requestUrl = new URL(STANDINGS_URL);
  requestUrl.searchParams.set("_scorebookRefresh", String(Date.now()));
  const response = await fetch(requestUrl, {
    headers: {
      "user-agent": "Oakmont Lions Scorebook Standings Bot/1.0",
      accept: "text/html,application/xhtml+xml",
      "cache-control": "no-cache",
      pragma: "no-cache"
    }
  });
  if (!response.ok) {
    throw new Error(`Pittsburgh NABA returned HTTP ${response.status}`);
  }
  return response.text();
}

async function readExistingPayload() {
  try {
    return JSON.parse(await readFile(STANDINGS_JSON_PATH, "utf8"));
  } catch {
    return null;
  }
}

function standingsSignature(rows = []) {
  return JSON.stringify(rows.map((row) => ({
    teamName: row.teamName,
    record: row.record,
    points: row.points,
    winPct: row.winPct,
    gb: row.gb,
    rf: row.rf,
    ra: row.ra,
    last10: row.last10,
    streak: row.streak
  })));
}

async function writeStandingsCache(payload) {
  await mkdir(path.dirname(STANDINGS_JSON_PATH), { recursive: true });
  await writeFile(STANDINGS_JSON_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeFile(
    STANDINGS_SCRIPT_PATH,
    `window.ScorebookLeagueStandingsCache = ${JSON.stringify(payload, null, 2)};\n`,
    "utf8"
  );
}

async function supabaseRequest(pathname, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase standings sync skipped because SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.");
  }
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}${pathname}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      prefer: "return=minimal",
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase ${pathname} failed with ${response.status}: ${body}`);
  }
}

async function upsertStandingsRows(rows, season) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return false;
  const params = new URLSearchParams({
    division: "eq.AA",
    season: `eq.${season}`
  });
  await supabaseRequest(`/rest/v1/league_standings?${params.toString()}`, {
    method: "DELETE"
  });
  await supabaseRequest("/rest/v1/league_standings", {
    method: "POST",
    headers: {
      prefer: "resolution=merge-duplicates"
    },
    body: JSON.stringify(rows)
  });
  return true;
}

async function main() {
  const html = await fetchStandingsHtml();
  const standings = parseAaStandings(html);
  const existingPayload = await readExistingPayload();
  const existingSignature = standingsSignature(existingPayload?.rows || []);
  const nextSignature = standingsSignature(standings);
  const syncedAt = existingSignature === nextSignature && existingPayload?.syncedAt
    ? existingPayload.syncedAt
    : new Date().toISOString();
  const rows = standings.map((team) => ({ ...team, syncedAt }));
  const payload = {
    season: LEAGUE_SEASON,
    division: "AA",
    sourceUrl: STANDINGS_URL,
    sourceLabel: "Pittsburgh NABA AA standings",
    syncedAt,
    rows
  };
  await writeStandingsCache(payload);

  let supabaseSynced = false;
  try {
    supabaseSynced = await upsertStandingsRows(rows.map((team) => ({
      season: LEAGUE_SEASON,
      division: "AA",
      rank: team.rank,
      team_name: team.teamName,
      team_code: team.teamCode,
      record: team.record,
      points: team.points,
      points_label: team.pointsLabel,
      win_pct: team.winPct,
      games_back: team.gb,
      runs_for: team.rf,
      runs_against: team.ra,
      last_ten: team.last10,
      streak: team.streak,
      source_url: STANDINGS_URL,
      source_label: "Pittsburgh NABA AA standings",
      synced_at: syncedAt
    })), LEAGUE_SEASON);
  } catch (error) {
    console.warn(error.message);
  }

  console.log(`Refreshed ${rows.length} AA standings rows for ${LEAGUE_SEASON}. Static cache updated. Supabase synced: ${supabaseSynced ? "yes" : "no"}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
