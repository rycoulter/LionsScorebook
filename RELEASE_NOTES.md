# Release Notes

Track user-facing changes to the Oakmont Lions baseball scorebook app here.

Add a new dated entry whenever app behavior, UI, scoring logic, storage, PWA assets, or data handling changes. Keep the newest entry at the top.

## 2026-04-20

### Changed
- Added a first-pass public/admin access mode with public read-only navigation for Home, Schedule & Scores, Stats, Archive, Scorebook, and Box Score, plus a single-password admin unlock for scoring and editing tools that stays unlocked across refreshes on the same device.
- Corrected the Score Game header again so when the Lions are batting the pitcher row is fully replaced by Count and Outs, and Count/Outs no longer duplicate in the Current Batter card or the top header blocks during Lions at-bats.
- Fixed the Score Game header layout so the Lions pitcher row only shows while the opponent is batting, and when the Lions are batting that same row now shows Count and Outs instead of repeating them inside the Current Batter card.
- Removed Scorebook from the main header tabs and added a View Scorebook action at the bottom of Score Game so scorebook access stays tied to the current game being scored.
- Reworked the score-game header so when the Lions are batting the top Count/Outs cards move out of the top row for easier at-bat visibility.
- Added a non-clickable current-batter badge at home plate using the same circular field marker style and made runner `SB` / `CS` / `PO` actions return the scorer to Pitch Mode after the action is recorded.
- Added traditional scorebook rendering for stolen base, caught stealing, and pickoff events using `SB`, `CS`, and `PO` notation so runner actions now appear in the scorebook and pickoffs stay distinct from caught stealing.
- Removed the tinted field container and chart backing so the live field reads as the SVG itself rather than a field sitting under a dark shell, while preserving the current runner selection and action behavior.
- Removed the dark field veil from the live score view by flattening the chart shell, removing the inset dimming, and brightening the field SVG colors, while leaving the current runner selection and action workflow untouched.
- Brightened the final active score-view field shell itself, including the live chart background and field SVG filter, to get back closer to the easier-to-read pre-runner-panel look without touching runner interactions or logic.
- Restored the live score field shell colors to the pre-brightening look from the earlier runner-action builds and bumped the build/cache again, without touching the current runner selection or action logic.
- Brightened the live score field shell and top-down SVG colors again so the field is easier to read after the runner-action panel update, then bumped the build/cache for Safari and iPad refreshes.
- Moved selected-runner SB/CS/PO actions into the main Pitch Mode scoring panel, hid the old floating runner action strip, and bumped the build/cache for fresh local and iPad testing.
- Surfaced the selected-runner SB/CS/PO action bar above the score field and bumped the build/cache again so local and iPad testing pick up the latest runner-action CSS.
- Fixed runner selection double-toggle by handling on-field runner badge selection only on pointerdown and bumped the build/cache again.
- Routed runner badge inline handlers explicitly through `window` and raised the field interaction layer above the score-field chrome for another runner-tap fix attempt.
- Explicitly exposed the runner badge click handler on `window` and bumped the build/cache again to tighten local-file runner interactions.
- Hardened on-field runner badge taps for iPad/Safari by making the runner overlay directly interactive and bumping the app/service-worker version.
- Made on-field runner badges brighter, added selected-runner SB/CS/PO controls, and tracked caught stealing plus pickoffs in player hitting stats.
- Refreshed the PWA cache version for the runner action update.
- Pulled first and third base farther inside the foul lines and pushed the live outfield fence farther back for a larger field footprint.
- Refreshed the PWA cache version for the field geometry refinement.
- Moved the live field fence farther back, removed defensive position chips, and cleaned up duplicate live base rendering.
- Removed the live box-style base tracker while keeping the circular on-field runner markers and runner actions intact.
- Refreshed the PWA cache version for the field cleanup pass.
- Rebuilt the live scoring field background as a simpler top-down SVG with flat grass, dirt, foul lines, bases, mound, and outfield arc while preserving overlay alignment.
- Refreshed the PWA cache version for the top-down field update.
- Reworked occupied baserunner field markers into smaller glowing number badges and aligned them closer to each base without changing runner actions.
- Kept the base diamonds visually quiet so occupied runners stand out on the field.
- Refreshed the PWA cache version for the baserunner field marker update.
- Refactored the live scoring field into background, position marker, spray chart, and baserunner layers while preserving rendering behavior.
- Rebuilt the live field background as layered inline SVG art and balanced the position markers against the field.
- Refreshed the PWA cache version for the field layer and visual shell update.
- Added a routed Box Score screen from Analysis with a game summary, inning line score, team tabs, batting table, and pitching table.
- Derived Box Score v1 runs, hits, errors, batting lines, and pitching lines from existing saved game events.
- Refreshed the PWA cache version for the Box Score screen.
- Cleaned up Analysis by replacing Hard-hit rate with team AVG and replacing game OBP with game AVG.
- Removed verbose lineup/play-by-play text, the static tracking explainer, and the Export JSON action from Analysis.
- Added View Box Score buttons to Analysis game breakdowns.
- Refreshed the PWA cache version for the Analysis cleanup.
- Kept Lions lineup positions on Select Position when players are added, swapped, normalized, or reloaded.
- Allowed Lions batting lineups to keep more than nine hitters while still requiring at least nine hitters and every defensive position.
- Updated bench actions to add an additional player after the first nine hitters are filled.
- Refreshed the PWA cache version for the lineup-position and extra-hitter update.
- Kept newly added Lions lineup players on Select Position so game positions are chosen manually.
- Added opponent jersey-number fields to pre-game opponent lineup setup and Score Game opponent lineup editing.
- Normalized opponent lineup entries so blank names fall back to Batter 1, Batter 2, and so on instead of `[object Object]`.
- Refreshed the PWA cache version for the lineup and opponent-number update.

## 2026-04-19

### Added
- Added a dedicated pre-game Lineup Builder screen between Start Game and Score Game.
- Added a separate starting pitcher selector for DH-for-pitcher lineups.

### Changed
- Moved full batting-order and game-position setup out of the Games page Start flow.
- Updated Score Game lineup display to show the assigned game position instead of roster eligibility.
- Limited live lineup changes to substitutions with a game-position selection.
- Updated Lineup Builder cards to show season AVG and OPS, added drag-and-drop ordering, and tuned the pre-game layout for iPad portrait use.
- Simplified Lineup Builder hitter stats into row helper text and changed starting pitcher stats to ERA/record placeholders.
- Refined Lineup Builder into a bench-first add flow with nine clean empty batting spots and all players available on the bench until selected.
- Improved Scorebook notation for standard defensive scoring marks like 6-3 groundouts, F8 flyouts, L6 lineouts, E6 errors, and common double-play/force-out patterns.
- Cleaned up the Schedule & Scores page with a hidden create-game form, tighter schedule inputs, matchup images, recent-completed-game limits, and an Archive prompt.
- Updated the live Score Game field visuals with a polished dark field, anchored runner badges, cleaner bases, and outcome-labeled spray markers.
- Refined the live Score Game field with brighter grass, clearer dirt, crisp foul lines, white bases, simplified labels, and circular runner badges.
- Refreshed the PWA cache version for the field-only visual cleanup.
- Grouped the Schedule & Scores All tab into Live, Upcoming, and Completed sections for clearer game order.
- Updated game locations to store field names with full addresses for weather lookup.
- Refreshed the PWA cache version for the schedule and location update.
- Added known-field weather coordinates so Home page weather resolves from structured field locations reliably.
- Prevented creating or editing non-final games with past dates.
- Refreshed the PWA cache version for the weather and date validation update.
- Replaced Lineup Builder drag reordering with accessible up/down batting-order buttons.
- Made the Lineup Builder bench list scroll independently while the starting lineup stays visible.
- Added a clickable missing-position warning that focuses the lineup position controls.
- Refreshed the PWA cache version for the Lineup Builder update.

## 2026-04-18

### Added
- Added clearer home/away game setup labels, field-location dropdowns, Games tab lifecycle filters, and final-game locking.
- Added a Lions home/away selector and Start Game flow so scheduled games stay future until explicitly started.
- Added Home page recent results plus archive summary, stats, and scorebook actions for completed games.
- Simplified Recent Results cards and normalized public matchup labels to Lions for matchup-image consistency.
- Added a blank Score Game state so only games started from Home/Games enter the scoring context.
- Added extra-inning support so tied games can continue after the seventh inning.
- Added a visible app build badge to help confirm which version Safari/iPad has loaded.
- Added a temporary service-worker disable path for stale-build debugging with `?no-sw=1`, a localStorage flag, or a code constant.
- Added weather chips to the homepage Next Game and Upcoming Games cards using scheduled game date and field location.

### Changed
- Added iPad Air 5th gen responsive tuning for 820x1180 portrait and 1180x820 landscape layouts across app pages.
- Cleaned up the viewport metadata for iPad Safari safe-area handling.
- Refreshed the PWA cache version for the iPad layout pass.
- Refreshed the PWA cache version for the build-debugging update.
- Redesigned the scoring area below the existing game-state header into an iPad landscape dashboard with a sidebar lineup, centered field, and bottom scoring dock.
- Updated the scoring header to refresh count and pitcher pitch totals immediately after each pitch.
- Restored the roster grid to a three-card desktop layout while preserving the current premium card design.
- Improved dark-theme styling for roster, stats spray chart, and scorebook dropdowns.
- Refreshed the PWA cache version so the latest scoring, weather, and layout updates are picked up after deployment.

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
