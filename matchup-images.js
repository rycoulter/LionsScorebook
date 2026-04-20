(function matchupImages(global) {
  const MATCHUP_IMAGE_FALLBACK = "new-lion.png";
  const TEAM_LOGO_FALLBACK = "assets/team-logos/lions.png";
  const OPPONENT_IMAGE_KEYS = [
    { aliases: ["eagles", "eagle"], key: "eagles", label: "Eagles" },
    { aliases: ["ducks", "duck"], key: "ducks", label: "Ducks" },
    { aliases: ["devils", "devil", "south hills devils"], key: "devils", label: "Devils" },
    { aliases: ["turtles", "turtle", "bauerstown turtles"], key: "turtles", label: "Turtles" },
    { aliases: ["d2", "pittsburgh d2"], key: "d2", label: "D2" },
    { aliases: ["bandidos", "bakery square bandidos"], key: "bandidos", label: "Bandidos" }
  ];

  function normalizeOpponentName(opponentName) {
    return String(opponentName || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function opponentImageKey(opponentName) {
    const normalized = normalizeOpponentName(opponentName);
    if (!normalized) return "";

    const match = OPPONENT_IMAGE_KEYS.find((entry) =>
      entry.aliases.some((alias) => {
        const normalizedAlias = normalizeOpponentName(alias);
        return normalized === normalizedAlias || normalized.includes(normalizedAlias);
      })
    );

    return match?.key || "";
  }

  function getMatchupImage(opponentName, lionsSide = "home") {
    const key = opponentImageKey(opponentName);
    if (!key) return MATCHUP_IMAGE_FALLBACK;

    const lionsAreAway = lionsSide === "away";
    const awayKey = lionsAreAway ? "lions" : key;
    const homeKey = lionsAreAway ? key : "lions";
    return `assets/matchups/${awayKey}@${homeKey}.png`;
  }

  function teamLogoKey(teamName = "", teamKey = "") {
    if (teamKey === "lions") return "lions";
    if (teamKey === "opponent") return opponentImageKey(teamName);

    const normalizedKey = normalizeOpponentName(teamKey);
    if (normalizedKey === "lions") return "lions";

    return opponentImageKey(teamName || teamKey);
  }

  function getTeamLogo(teamName = "", teamKey = "") {
    const key = teamLogoKey(teamName, teamKey);
    return key ? `assets/team-logos/${key}.png` : TEAM_LOGO_FALLBACK;
  }

  global.MatchupImages = {
    fallback: MATCHUP_IMAGE_FALLBACK,
    getMatchupImage,
    getTeamLogo,
    opponentImageKey,
    knownOpponents: OPPONENT_IMAGE_KEYS.map((entry) => entry.label),
    normalizeOpponentName
  };
})(window);
