import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const LEAGUE_SEASON = Number(process.env.LEAGUE_SEASON) || new Date().getFullYear();
const ROSTERS_JSON_PATH = path.join("data", "naba-rosters.json");
const ROSTERS_SCRIPT_PATH = path.join("data", "naba-rosters-cache.js");

const TEAM_SOURCES = [
  { teamName: "Oakmont Lions", teamKey: "oakmont-lions", teamCode: "OAK", nabaKey: "NORTHAMERICANLIONS" },
  { teamName: "Pittsburgh D2", teamKey: "pittsburgh-d2", teamCode: "PD2", nabaKey: "PITTSBU-PITTSBURGHD2" },
  { teamName: "BiscuitvilleTownSquare Bandidos", teamKey: "biscuitvilletownsquare-bandidos", teamCode: "BAN", nabaKey: "BAKERYSQUAREBANDIDOS" },
  { teamName: "South Hills Devils", teamKey: "south-hills-devils", teamCode: "SHD", nabaKey: "PIT-SOUTHHILLSDEVILS" },
  { teamName: "South Oakland Ducks", teamKey: "south-oakland-ducks", teamCode: "DUX", nabaKey: "SOUTHOAKLANDDUCKS" },
  { teamName: "South Side Eagles", teamKey: "south-side-eagles", teamCode: "SSE", nabaKey: "PITT-SOUTHSIDEEAGLES" },
  { teamName: "Bauerstown Turtles", teamKey: "bauerstown-turtles", teamCode: "TUR", nabaKey: "BAUERSTOWNTURTLES" },
  { teamName: "Keystone Oaks", teamKey: "keystone-oaks", teamCode: "KEY", nabaKey: "PITTSBU-KEYSTONEOAKS" },
  { teamName: "Butler Buccos", teamKey: "butler-buccos", teamCode: "BUC", nabaKey: "PITTSBU-BUTLERBUCCOS" },
  { teamName: "Ross Raiders", teamKey: "ross-raiders", teamCode: "RRS", nabaKey: "PITTSBUR-ROSSRAIDERS" }
];

function rosterUrl(nabaKey) {
  return `https://www.pittsburghnaba.org/teams/default.asp?p=roster&s=baseball&u=${encodeURIComponent(nabaKey)}`;
}

function decodeHtmlEntities(value = "") {
  return String(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&middot;/gi, ", ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanCell(value = "") {
  return decodeHtmlEntities(String(value).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]*>/g, " "))
    .replace(/\u00a0/g, " ")
    .replace(/\u00c2\u00b7/g, ", ")
    .replace(/\bImage(?=[A-Z])/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeRosterName(rawName = "") {
  const cleaned = cleanCell(rawName)
    .replace(/\s+-\s+Captain$/i, "")
    .replace(/\s+-\s+Asst\.\s*Capt\.?$/i, "")
    .replace(/\s+-\s+Assistant\s+Captain$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return { firstName: "", lastName: "", name: "" };
  }
  if (cleaned.includes(",")) {
    const [lastName, ...firstParts] = cleaned.split(",");
    const firstName = firstParts.join(",").trim();
    return {
      firstName,
      lastName: lastName.trim(),
      name: `${firstName} ${lastName}`.trim()
    };
  }
  const parts = cleaned.split(/\s+/);
  const firstName = parts.shift() || "";
  const lastName = parts.join(" ");
  return {
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim()
  };
}

function parseRosterRows(html = "", sourceTeam) {
  const rowMatches = [...String(html || "").matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const rows = [];
  for (const rowMatch of rowMatches) {
    const cells = [...rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => cleanCell(cell[1]));
    if (cells.length < 2) continue;

    const headerCells = cells.map((cell) => cell.toLowerCase());
    if (headerCells.includes("name") || headerCells.includes("no")) continue;

    let number = "";
    let rawName = "";
    let positions = "";
    if (/^\d{1,3}$/.test(cells[0]) || !cells[0]) {
      number = cells[0] || "";
      rawName = cells[1] || "";
      positions = cells[2] || "";
    } else {
      rawName = cells[0] || "";
      positions = cells[1] || "";
    }

    const normalizedName = normalizeRosterName(rawName);
    if (!normalizedName.name || /^name$/i.test(normalizedName.name)) continue;

    rows.push({
      id: `${sourceTeam.teamKey}-${slug(normalizedName.name) || rows.length}`,
      firstName: normalizedName.firstName,
      lastName: normalizedName.lastName,
      name: normalizedName.name,
      number,
      positions
    });
  }

  const seen = new Set();
  return rows.filter((player) => {
    const key = `${player.number}|${player.name}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchRosterHtml(sourceTeam) {
  if (process.env.NABA_ROSTER_HTML_DIR) {
    return readFile(path.join(process.env.NABA_ROSTER_HTML_DIR, `${sourceTeam.nabaKey}.html`), "utf8");
  }
  const requestUrl = new URL(rosterUrl(sourceTeam.nabaKey));
  requestUrl.searchParams.set("_scorebookRefresh", String(Date.now()));
  const response = await fetch(requestUrl, {
    headers: {
      "user-agent": "Oakmont Lions Scorebook Roster Bot/1.0",
      accept: "text/html,application/xhtml+xml",
      "cache-control": "no-cache",
      pragma: "no-cache"
    }
  });
  if (!response.ok) {
    throw new Error(`${sourceTeam.teamName} roster returned HTTP ${response.status}`);
  }
  return response.text();
}

async function readExistingPayload() {
  try {
    return JSON.parse(await readFile(ROSTERS_JSON_PATH, "utf8"));
  } catch {
    return null;
  }
}

function rosterSignature(teams = []) {
  return JSON.stringify(teams.map((team) => ({
    teamName: team.teamName,
    teamKey: team.teamKey,
    players: (team.players || []).map((player) => ({
      name: player.name,
      number: player.number,
      positions: player.positions
    }))
  })));
}

async function writeRosterCache(payload) {
  await mkdir(path.dirname(ROSTERS_JSON_PATH), { recursive: true });
  await writeFile(ROSTERS_JSON_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeFile(
    ROSTERS_SCRIPT_PATH,
    `window.ScorebookNabaRostersCache = ${JSON.stringify(payload, null, 2)};\n`,
    "utf8"
  );
}

async function main() {
  const existingPayload = await readExistingPayload();
  const teams = [];

  for (const sourceTeam of TEAM_SOURCES) {
    try {
      const html = await fetchRosterHtml(sourceTeam);
      const players = parseRosterRows(html, sourceTeam);
      teams.push({
        ...sourceTeam,
        sourceUrl: rosterUrl(sourceTeam.nabaKey),
        players
      });
    } catch (error) {
      const existingTeam = existingPayload?.teams?.find((team) => team.teamKey === sourceTeam.teamKey);
      if (existingTeam) {
        teams.push(existingTeam);
        console.warn(`${sourceTeam.teamName}: ${error.message}. Kept existing cached roster.`);
      } else {
        teams.push({
          ...sourceTeam,
          sourceUrl: rosterUrl(sourceTeam.nabaKey),
          players: [],
          error: error.message
        });
        console.warn(`${sourceTeam.teamName}: ${error.message}. No cached roster available.`);
      }
    }
  }

  const existingSignature = rosterSignature(existingPayload?.teams || []);
  const nextSignature = rosterSignature(teams);
  const syncedAt = existingSignature === nextSignature && existingPayload?.syncedAt
    ? existingPayload.syncedAt
    : new Date().toISOString();

  const payload = {
    season: LEAGUE_SEASON,
    sourceLabel: "Pittsburgh NABA rosters",
    syncedAt,
    teams: teams.map((team) => ({ ...team, syncedAt }))
  };
  await writeRosterCache(payload);

  const playerCount = payload.teams.reduce((sum, team) => sum + (team.players?.length || 0), 0);
  console.log(`Refreshed ${payload.teams.length} NABA rosters with ${playerCount} players for ${LEAGUE_SEASON}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
