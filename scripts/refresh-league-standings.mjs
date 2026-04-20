const STANDINGS_URL = process.env.PITTSBURGH_NABA_STANDINGS_URL
  || "https://www.pittsburghnaba.org/teams/default.asp?p=standings&s=baseball&u=PITTSBURGHNABA";
const DIVISION = "AA";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function visibleTextFromHtml(html) {
  return decodeHtml(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(tr|p|div|li|h\d|table|tbody|thead|section|article)>/gi, "\n")
    .replace(/<(td|th|br)\b[^>]*>/gi, " | ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\u00a0/g, " ");
}

function parseRecord(record) {
  const [wins, losses, ties] = String(record || "0-0")
    .split("-")
    .map((value) => Number.parseInt(value, 10) || 0);
  return { wins, losses, ties: ties || 0 };
}

function teamSlug(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function teamCode(name) {
  const words = String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.replace(/[^a-z0-9]/gi, ""));
  const initials = words.map((word) => word[0]).join("").slice(0, 3).toUpperCase();
  return initials || String(name || "TM").replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "TM";
}

function parseAaStandings(html) {
  const normalized = visibleTextFromHtml(html).replace(/\s+/g, " ").trim();
  const tokens = normalized
    .split("|")
    .map((token) => token.trim())
    .filter(Boolean);
  const header = ["AA", "Team", "Record", "Pts", "Win %", "GB", "Home", "Away", "RF", "RA", "Last 10", "Streak"];
  const aaIndex = tokens.findIndex((token, index) => (
    token === "AA" && header.every((expected, offset) => String(tokens[index + offset] || "").toLowerCase() === expected.toLowerCase())
  ));
  if (aaIndex < 0) {
    throw new Error("Unable to locate the AA standings header in the Pittsburgh NABA response.");
  }

  const rows = [];
  for (let index = aaIndex + header.length; index <= tokens.length - 11; index += 11) {
    const maybeDivision = String(tokens[index] || "").toUpperCase();
    if (maybeDivision === "A" || maybeDivision === "AAA" || maybeDivision === "PRINT") break;
    const record = tokens[index + 1];
    const points = tokens[index + 2];
    const winPct = tokens[index + 3];
    if (!/^\d+-\d+(?:-\d+)?$/.test(record || "") || !/^\d+$/.test(points || "") || !/^\.\d{3}$/.test(winPct || "")) {
      continue;
    }
    rows.push({
      name: tokens[index],
      record,
      points: Number(points) || 0,
      winPct,
      gb: tokens[index + 4] || "-",
      rf: Number(tokens[index + 7]) || 0,
      ra: Number(tokens[index + 8]) || 0,
      last10: tokens[index + 9] || "--",
      streak: tokens[index + 10] || "--"
    });
  }

  if (!rows.length) {
    throw new Error("Located the AA standings header but parsed zero standings rows.");
  }

  return rows;
}

async function fetchStandingsHtml() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("timeout"), 20000);
  try {
    const response = await fetch(STANDINGS_URL, {
      headers: {
        "user-agent": "Oakmont Lions Scorebook Standings Bot/1.0",
        accept: "text/html,application/xhtml+xml"
      },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Pittsburgh NABA returned ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function supabaseRequest(path, options = {}) {
  const supabaseUrl = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation,resolution=merge-duplicates",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase request failed (${response.status}): ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function upsertStandingsRows(rows, season) {
  const ids = rows.map((row) => row.id);
  await supabaseRequest("/rest/v1/league_standings", {
    method: "POST",
    body: JSON.stringify(rows)
  });

  const params = new URLSearchParams({
    season: `eq.${season}`,
    division: `eq.${DIVISION}`,
    id: `not.in.(${ids.join(",")})`
  });

  await supabaseRequest(`/rest/v1/league_standings?${params.toString()}`, {
    method: "DELETE",
    headers: {
      Prefer: "return=minimal"
    }
  });
}

async function main() {
  const season = Number.parseInt(process.env.LEAGUE_SEASON || "", 10) || new Date().getFullYear();
  const html = await fetchStandingsHtml();
  const standings = parseAaStandings(html);
  const syncedAt = new Date().toISOString();

  const rows = standings.map((team, index) => {
    const record = parseRecord(team.record);
    return {
      id: `${season}-${DIVISION.toLowerCase()}-${teamSlug(team.name)}`,
      season,
      division: DIVISION,
      rank: index + 1,
      team_name: team.name,
      team_code: teamCode(team.name),
      wins: record.wins,
      losses: record.losses,
      ties: record.ties,
      record: team.record,
      points: team.points,
      win_pct: team.winPct,
      games_back: team.gb,
      runs_for: team.rf,
      runs_against: team.ra,
      last_ten: team.last10,
      streak: team.streak,
      source_url: STANDINGS_URL,
      source_label: "Pittsburgh NABA AA standings",
      synced_at: syncedAt,
      metadata: {
        refreshed_by: "github-actions",
        division: DIVISION
      }
    };
  });

  await upsertStandingsRows(rows, season);

  console.log(JSON.stringify({
    ok: true,
    season,
    division: DIVISION,
    count: rows.length,
    teams: rows.map((row) => ({
      rank: row.rank,
      team_name: row.team_name,
      record: row.record,
      points: row.points
    }))
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
