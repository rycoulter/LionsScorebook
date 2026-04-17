(function matchupImages(global) {
  const MATCHUP_IMAGE_FALLBACK = "lions-logo.png";
  const MATCHUP_IMAGE_MAP = [
    { aliases: ["eagles", "eagle"], src: "assets/matchups/lions-vs-eagles.png" },
    { aliases: ["ducks", "duck"], src: "assets/matchups/lions-vs-ducks.png" },
    { aliases: ["devils", "devil", "south hills devils"], src: "assets/matchups/lions-vs-devils.png" },
    { aliases: ["turtles", "turtle", "bauerstown turtles"], src: "assets/matchups/lions-vs-turtles.png" },
    { aliases: ["d2", "pittsburgh d2"], src: "assets/matchups/lions-vs-d2.png" },
    { aliases: ["bandidos", "bakery square bandidos"], src: "assets/matchups/lions-vs-bandidos.png" }
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

  function getMatchupImage(opponentName) {
    const normalized = normalizeOpponentName(opponentName);
    if (!normalized) return MATCHUP_IMAGE_FALLBACK;

    const match = MATCHUP_IMAGE_MAP.find((entry) =>
      entry.aliases.some((alias) => {
        const normalizedAlias = normalizeOpponentName(alias);
        return normalized === normalizedAlias || normalized.includes(normalizedAlias);
      })
    );

    return match?.src || MATCHUP_IMAGE_FALLBACK;
  }

  global.MatchupImages = {
    fallback: MATCHUP_IMAGE_FALLBACK,
    getMatchupImage,
    normalizeOpponentName
  };
})(window);
