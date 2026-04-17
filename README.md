# Oakmont Lions Scorebook

A local-first baseball scorebook for the Oakmont Lions. Open `index.html` in a browser to score games, manage the roster, build lineups, review past games, and run lineup analysis from the data you log.

## What It Tracks

- Plate appearance results: 1B, 2B, 3B, HR, BB, HBP, ROE, FC, K, batted outs, sacrifices, steals, and caught stealing.
- Pitch-by-pitch count flow: balls, called strikes, swinging strikes, fouls, and balls in play.
- Game context: scheduled opponent, date, location, inning, half inning, outs, bases, score, and coach notes.
- Contact profile: weak, solid, hard hit, barrel, plus launch band and spray location.
- Player grades: contact, power, speed, and defense on a 20-80 coaching scale.
- Derived stats: AVG, OBP, SLG, OPS, BABIP, wOBA-lite, pitches per plate appearance, first-pitch strike rate, strikeout rate, walk rate, hard-hit rate, and stolen-base success.
- Pitching stats: innings pitched, pitch count, balls, strikes, strike percentage, batters faced, hits, runs, walks, strikeouts, K%, BB%, K/BB, K/9, WHIP, and pitches per inning.

## Scoring Flow

Use the pitch buttons to build the count during the plate appearance. A fourth ball selects walk, and a third strike selects strikeout, but the play is not saved until you tap `Complete AB`, giving you time to confirm runs, RBI, and notes.

When the ball is put in play, tap `Ball In Play`, then tap the spray chart where the ball landed or was fielded. The chart saves the location with the completed play and opens on the current hitter by default, with options for the whole team, current game, hits only, or outs only.

Use the runner tracker to see the bases in a focused view. Steal controls log safe steals and caught stealing without ending the current plate appearance.

Use the `Games` tab to create scheduled games and choose the game you want to score. Edit the opponent lineup directly on the scoring tab for that game. When the half inning changes to the opponent, the AB card switches to simple opponent scoring with one-tap outcomes like `1B`, `BB`, `K`, and `Groundout`, while still tracking the Lions pitcher count, balls, strikes, and strike percentage.

The AB card also summarizes the current hitter's previous plate appearances in the game, for both Lions hitters and opponent hitters.

## Lineup Model

The optimizer blends live production with coach grades:

- Run creation: OBP, SLG, wOBA-lite, and RBI production.
- Contact reliability: strikeout avoidance, solid contact, hard-hit and barrel frequency.
- Speed pressure: coach speed grade, stolen bases, and caught-stealing penalty.
- Defensive stability: coach defense grade and positional coverage.

The batting-order roles are intentionally baseball-shaped:

- Leadoff favors OBP, speed, and contact.
- Second favors OBP and bat-to-ball skill.
- Third favors the best all-around bat.
- Fourth and fifth favor power and run production.
- The lower third balances defensive fit, contact, and lineup turnover speed.

## MLB Source Notes

The stat model follows MLB.com's public glossary and Statcast framing:

- MLB's Statcast glossary emphasizes measurable skills across hitting, pitching, running, and fielding, including exit velocity, launch angle, barrels, xBA, xwOBA, Outs Above Average, and sprint speed: https://www.mlb.com/glossary/statcast
- MLB defines wOBA as an on-base metric that weights each way a player reaches base by run value, which is why the app uses a simplified wOBA-style value score instead of treating every time on base equally: https://www.mlb.com/glossary/advanced-stats/weighted-on-base-average
- MLB defines BABIP as batting average on balls in play, excluding home runs and strikeouts, which is why the app separates batted-ball results and contact quality from raw batting average: https://www.mlb.com/glossary/advanced-stats/babip
- MLB's launch angle bands map contact into ground balls, line drives, fly balls, and popups, so the score form captures those coachable launch categories: https://www.mlb.com/glossary/statcast/launch-angle
- MLB defines pitch count as every pitch thrown in live game action, which is why the opponent half tracks total pitches, balls, strikes, and pitch efficiency by Lions pitcher: https://www.mlb.com/glossary/standard-stats/number-of-pitches
- MLB defines WHIP as walks plus hits divided by innings pitched, a direct measure of how well a pitcher keeps runners off base: https://www.mlb.com/glossary/standard-stats/walks-and-hits-per-inning-pitched
- MLB defines K%, BB%, K/BB, K/9, and pitches per inning as useful pitcher evaluation tools, so the Stats tab separates pitching from hitting and includes those rates: https://www.mlb.com/glossary/advanced-stats/strikeout-rate, https://www.mlb.com/glossary/advanced-stats/walk-rate, https://www.mlb.com/glossary/advanced-stats/strikeout-to-walk-ratio/, https://www.mlb.com/glossary/advanced-stats/strikeouts-per-nine-innings, https://www.mlb.com/glossary/advanced-stats/pitches-per-inning-pitched

## Notes For Coaches

This first version is deliberately local-first. Your roster, games, and scores are saved in browser local storage on the machine where you use it. The Analysis tab has an export button so you can keep backups or share the raw data.

When scoring defense or opponent innings, tap `End Half` to move to the bottom half. Events logged in the bottom half update opponent runs and game flow without counting as Lions batting stats.
