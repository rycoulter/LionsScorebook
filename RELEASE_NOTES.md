# Release Notes

Track user-facing changes to the Oakmont Lions baseball scorebook app here.

Add a new dated entry whenever app behavior, UI, scoring logic, storage, PWA assets, or data handling changes. Keep the newest entry at the top.

## 2026-04-17

### Added
- Added reusable matchup-image lookup for homepage opponent graphics.
- Added Lions matchup graphics for Bandidos, D2, Devils, Ducks, Eagles, and Turtles.
- Added a homepage Upcoming Games section showing the next two scheduled games after the main Next Game card.
- Added scouting report buttons to homepage upcoming-game cards that auto-select the matching opponent report.
- Added structured opponent lineup editing in the scoring sidebar.
- Added in-play out detail flow: choose out type, then choose the fielder.
- Added scorebook notation generation for common outs, including groundouts like `6-3`, flyouts like `F8`, and lineouts like `L6`.

### Changed
- Added a Current Batter card beside the Lions pitcher header with a season AVG tile.
- Removed the duplicate inning/outs context line from the lower-left of the scoring header.
- Refreshed the PWA cache version so the scoring-header layout update is picked up after deployment.
- Brightened the scoring field so it reads as a cleaner baseball surface instead of a dark overlay panel.
- Moved the active batter/count tracker responsibility into the top game-state header and hid the duplicate field overlay card from the spray chart.
- Refreshed the PWA cache version so the scoring-screen styling update is picked up after deployment.
- Replaced the demo roster with the real Oakmont roster and normalized roster positions as arrays.
- Redesigned the scoring field visuals into a cleaner top-down baseball field with brighter grass, clay infield shapes, white baselines, visible bases, and a pitcher mound while preserving spray chart interactions.
- Refactored scoring-field positioning to use a shared percentage coordinate system for bases, runners, pitcher, fielders, foul lines, and the infield diamond.
- Updated the homepage Next Game card to choose its matchup graphic dynamically from the upcoming opponent.
- Improved scouting report opponent matching from the homepage with a fuzzy name lookup for partial team names.
- Cleaned up the scoring field with a darker stadium-style look, brighter bases, and occupied-base gold highlights.
- Refined the bottom scoring panel into a cleaner pitch/outcome/spray/runner flow with a secondary More Results action.
- Improved runner decision cards with clearer auto/adjusted movement labels and segmented action buttons.
- Added subtle visual feedback for spray chart placement and runner/base state changes.
- Updated opponent scoring so `In Play` opens the same step-based outcome flow used for Oakmont at-bats, including out type and fielder selection.
- Moved pitcher information into the top game-state header and restyled it as a compact dark card so it no longer floats over the field.
- Realigned the score header so the pitcher card spans a clean second-row area and its stat tiles no longer crowd the score.
- Separated the Games tab create-game form from the active game so typing schedule details does not mutate the currently active game.
- Updated homepage game context logic to prefer the next upcoming non-final game.
- Updated Home -> Score behavior to move from a final active game to the next upcoming game when available.
- Improved dark theme contrast for scoring lineups, stats tables, scouting cards, and coach plan text.
- Hid the spray chart guide card from the scoring field header area while preserving spray chart functionality.
- Refreshed the PWA cache version to load the latest app assets.

### Fixed
- Fixed Games tab readability for the selected game card and lineup builder rows under the dark theme.
- Fixed a risk where creating a new game could overwrite or mutate an existing active game.
- Fixed Next Game showing past final games.
- Fixed in-play outs defaulting all outs to groundout notation.
