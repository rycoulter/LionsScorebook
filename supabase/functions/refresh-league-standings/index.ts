import { createClient } from "npm:@supabase/supabase-js@2";

const STANDINGS_URL = "https://www.pittsburghnaba.org/teams/default.asp?p=standings&s=baseball&u=PITTSBURGHNABA";
const STANDINGS_FALLBACK_URL = "https://pittsburghnaba.org/teams/default.asp?p=standings&s=baseball&u=PITTSBURGHNABA";
const DIVISION = "AA";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function visibleTextFromHtml(html: string) {
  return decodeHtml(String(html || ""))
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(tr|p|div|li|h\d|table|tbody|thead|section|article)>/gi, "\n")
    .replace(/<(td|th|br)\b[^>]*>/gi, " | ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\u00a0/g, " ");
}

function scoutingLines(text: string) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\t/g, " | ")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractAaDebugLines(html: string) {
  const lines = scoutingLines(visibleTextFromHtml(html));
  const divisionIndex = lines.findIndex((line) => /^AA$/i.test(line));
  if (divisionIndex < 0) return [];
  const slice = [];
  for (let index = divisionIndex; index < lines.length && slice.length < 18; index += 1) {
    const line = lines[index];
    if (slice.length > 0 && /^(AAA|A)$/i.test(line)) break;
    slice.push(line);
  }
  return slice;
}

function extractAaDebugSnippet(html: string) {
  const normalized = visibleTextFromHtml(html).replace(/\s+/g, " ").trim();
  const aaIndex = normalized.indexOf("AA");
  if (aaIndex < 0) return normalized.slice(0, 900);
  return normalized.slice(Math.max(0, aaIndex - 120), aaIndex + 1200);
}

function parsePipeDelimitedStandingsBlock(block: string) {
  const tokens = String(block || "")
    .split("|")
    .map((token) => token.trim())
    .filter(Boolean);
  const rows = [];
  for (let index = 0; index <= tokens.length - 11; index += 11) {
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
  return rows;
}

function parsePipeDelimitedAaPage(normalized: string) {
  const tokens = String(normalized || "")
    .split("|")
    .map((token) => token.trim())
    .filter(Boolean);
  const header = ["AA", "Team", "Record", "Pts", "Win %", "GB", "Home", "Away", "RF", "RA", "Last 10", "Streak"];
  const aaIndex = tokens.findIndex((token, index) => (
    token === "AA" && header.every((expected, offset) => String(tokens[index + offset] || "").toLowerCase() === expected.toLowerCase())
  ));
  if (aaIndex < 0) return [];

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
  return rows;
}

function parseCompactStandingsBlock(block: string) {
  const rowPattern = /(?<name>[A-Za-z0-9&'’:\-. ]+?)(?<record>\d+-\d+(?:-\d+)?)\s+(?<points>\d+)\s+(?<winPct>\.\d{3})\s+(?<gb>-|\d+(?:\.\d+)?)\s+(?<home>\d+-\d+(?:-\d+)?)\s+(?<away>\d+-\d+(?:-\d+)?)\s+(?<rf>\d+)\s+(?<ra>\d+)\s+(?<last10>\d+-\d+(?:-\d+)?)\s+(?<streak>(?:Won|Lost)\s+\d+)/gi;
  const rows = [];
  for (const match of block.matchAll(rowPattern)) {
    if (!match.groups) continue;
    rows.push({
      name: match.groups.name.trim(),
      record: match.groups.record,
      points: Number(match.groups.points) || 0,
      winPct: match.groups.winPct || "--",
      gb: match.groups.gb || "-",
      rf: Number(match.groups.rf) || 0,
      ra: Number(match.groups.ra) || 0,
      last10: match.groups.last10 || "--",
      streak: match.groups.streak || "--"
    });
  }
  return rows;
}

function parseAaStandings(html: string) {
  const lines = scoutingLines(visibleTextFromHtml(html));
  const divisionIndex = lines.findIndex((line) => /^AA$/i.test(line));
  if (divisionIndex >= 0) {
    const headerIndex = lines.findIndex((line, index) => index > divisionIndex && /^Team\s*\|/i.test(line));
    if (headerIndex >= 0) {
      const rows = [];
      const compactRowPattern = /^(?<name>.+?)(?<record>\d+-\d+(?:-\d+)?)\s+(?<points>\d+)\s+(?<winPct>\.\d{3})\s+(?<gb>-|\d+(?:\.\d+)?)\s+(?<home>\d+-\d+(?:-\d+)?)\s+(?<away>\d+-\d+(?:-\d+)?)\s+(?<rf>\d+)\s+(?<ra>\d+)\s+(?<last10>\d+-\d+(?:-\d+)?)\s+(?<streak>(?:Won|Lost)\s+\d+)$/i;
      for (let index = headerIndex + 1; index < lines.length; index += 1) {
        const line = lines[index];
        if (/^(AAA|AA|A)$/i.test(line)) break;
        if (/^(PRINT|Image:|Previous|Next|Number of Visitors|\d{4}\s*-)/i.test(line)) break;
        const cells = line.includes("|")
          ? line.split("|").map((cell) => cell.trim()).filter(Boolean)
          : [];
        if (cells.length >= 11 && !/^Team$/i.test(cells[0])) {
          rows.push({
            name: cells[0],
            record: cells[1],
            points: Number(cells[2]) || 0,
            winPct: cells[3] || "--",
            gb: cells[4] || "-",
            rf: Number(cells[7]) || 0,
            ra: Number(cells[8]) || 0,
            last10: cells[9] || "--",
            streak: cells[10] || "--"
          });
          continue;
        }
        const match = line.match(compactRowPattern);
        if (!match?.groups) continue;
        rows.push({
          name: match.groups.name.trim(),
          record: match.groups.record,
          points: Number(match.groups.points) || 0,
          winPct: match.groups.winPct || "--",
          gb: match.groups.gb || "-",
          rf: Number(match.groups.rf) || 0,
          ra: Number(match.groups.ra) || 0,
          last10: match.groups.last10 || "--",
          streak: match.groups.streak || "--"
        });
      }
      if (rows.length) return rows;
    }
  }

  const normalized = visibleTextFromHtml(html).replace(/\s+/g, " ").trim();
  const parsedPageRows = parsePipeDelimitedAaPage(normalized);
  if (parsedPageRows.length) return parsedPageRows;
  const aaPipeBlockMatch = normalized.match(/\bAA\s*\|\s*Team\s*\|\s*Record\s*\|\s*Pts\s*\|\s*Win\s*%\s*\|\s*GB\s*\|\s*Home\s*\|\s*Away\s*\|\s*RF\s*\|\s*RA\s*\|\s*Last\s*10\s*\|\s*Streak\s*\|\s*([\s\S]*?)(?:\|\s*A\s*\|\s*Team\s*\|\s*Record\s*\|\s*Pts\s*\|\s*Win\s*%|\|\s*PRINT\b|$)/i);
  if (aaPipeBlockMatch?.[1]) {
    const parsedPipeRows = parsePipeDelimitedStandingsBlock(aaPipeBlockMatch[1]);
    if (parsedPipeRows.length) return parsedPipeRows;
  }
  const aaBlockMatch = normalized.match(/\bAA\s+Team\s+Record\s+Pts\s+Win\s+%GB\s+Home\s+Away\s+RF\s+RA\s+Last\s+10\s+Streak\s+([\s\S]*?)(?:\s+\bA\s+Team\s+Record\s+Pts\s+Win\s+%GB|\s+PRINT\b|$)/i);
  if (!aaBlockMatch?.[1]) return [];
  return parseCompactStandingsBlock(aaBlockMatch[1]);
}

function teamSlug(name: string) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function teamCode(name: string) {
  const words = String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.replace(/[^a-z0-9]/gi, ""));
  const initials = words.map((word) => word[0]).join("").slice(0, 3).toUpperCase();
  return initials || String(name || "TM").replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "TM";
}

function parseRecord(record: string) {
  const [wins, losses, ties] = String(record || "0-0")
    .split("-")
    .map((value) => Number.parseInt(value, 10) || 0);
  return {
    wins,
    losses,
    ties: ties || 0
  };
}

async function fetchStandingsHtml() {
  const urls = [STANDINGS_URL, STANDINGS_FALLBACK_URL];
  const errors: string[] = [];

  for (const url of urls) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort("timeout"), 15000);
    try {
      console.log(`[refresh-league-standings] Fetching ${url}`);
      const response = await fetch(url, {
        headers: {
          "user-agent": "Oakmont Lions Scorebook Standings Bot/1.0",
          accept: "text/html,application/xhtml+xml"
        },
        signal: controller.signal
      });
      if (!response.ok) {
        errors.push(`${url} returned ${response.status}`);
        continue;
      }
      const html = await response.text();
      if (html) return { html, url, errors };
      errors.push(`${url} returned an empty response body`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${url} failed: ${message}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return { html: "", url: "", errors };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok");
  if (request.method !== "POST" && request.method !== "GET") {
    return json({ error: "Method not allowed." }, 405);
  }

  const configuredSecret = Deno.env.get("LEAGUE_REFRESH_SECRET");
  const suppliedSecret = request.headers.get("x-refresh-secret") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (configuredSecret && suppliedSecret !== configuredSecret) {
    return json({ error: "Unauthorized." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Missing Supabase environment variables." }, 500);
  }

  const seasonParam = new URL(request.url).searchParams.get("season");
  const season = Number.parseInt(seasonParam || "", 10) || new Date().getFullYear();

  const { html, url: sourceUrl, errors } = await fetchStandingsHtml();
  if (!html) {
    console.log("[refresh-league-standings] Fetch errors:", JSON.stringify(errors));
    return json({ error: "Unable to fetch Pittsburgh NABA standings.", details: errors }, 504);
  }

  const standings = parseAaStandings(html);
  if (!standings.length) {
    console.log("[refresh-league-standings] Unable to parse AA standings.");
    console.log("[refresh-league-standings] AA debug lines:", JSON.stringify(extractAaDebugLines(html), null, 2));
    console.log("[refresh-league-standings] AA debug snippet:", extractAaDebugSnippet(html));
    return json({ error: "Unable to parse AA standings from the Pittsburgh NABA standings page." }, 502);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

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
      source_url: sourceUrl || STANDINGS_URL,
      source_label: "Pittsburgh NABA AA standings",
      synced_at: new Date().toISOString(),
      metadata: {
        pulled_from: "pittsburgh-naba",
        division: DIVISION
      }
    };
  });

  const deleteResponse = await supabase
    .from("league_standings")
    .delete()
    .eq("season", season)
    .eq("division", DIVISION);
  if (deleteResponse.error) {
    return json({ error: deleteResponse.error.message }, 500);
  }

  const insertResponse = await supabase
    .from("league_standings")
    .insert(rows);
  if (insertResponse.error) {
    return json({ error: insertResponse.error.message }, 500);
  }

  return json({
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
  });
});
