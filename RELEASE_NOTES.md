# Release Notes

Track user-facing changes to the Oakmont Lions baseball scorebook app here.

Add a new dated entry whenever app behavior, UI, scoring logic, storage, PWA assets, or data handling changes. Keep the newest entry at the top.

## 2026-04-20

### Changed
- Updated pitcher decision logic for 7-inning games so a starter now qualifies for the win at 4 innings (12 outs), and `ND` is only assigned to the starting pitcher instead of every reliever who appeared.
- Fixed a shared-sync race where removing or editing games could be skipped if another Supabase snapshot sync was already in flight, which let deleted schedule items reappear from the cloud on refresh or another device.
- Fixed batting `GP` on the Stats page so scheduled/unplayed games no longer count toward every hitter's games played just because they inherit a default lineup shell.
- Added a stronger Lions `Now Hitting` walk-up card before each new at-bat that spotlights the current batter with On Deck and In The Hole behind them, briefly pauses pitch entry, and then auto-dismisses or lets the scorer tap `Start At-Bat` to continue immediately.
- Added a Lions inning-start lineup preview in the Score view that pops up the next three hitters as Up Next, On Deck, and In The Hole at the start of a fresh offensive half-inning, then gets out of the way once scoring begins.
- Reworked opponent baserunner scoring so opponent balls in play now use the same advance/hold/out runner-decision flow as Lions scoring, and runner badges on defense can also trigger SB, CS, and pickoff actions from the step panel.
- Fixed completed-game publish so the game data and final `synced` status are persisted to Supabase in the same snapshot, which prevents offline-scored games from briefly looking synced and then falling back out of sync from a stale remote status copy.
- Reworked the Stats page on phones into a true mobile card layout with compact sort controls and stacked batting/pitching summaries, so users no longer have to fight a compressed desktop table on small screens.
- Removed the Home page League Standings card from the live UI for now so the dashboard stays focused on the pieces that are fully dialed in, while keeping the standings sync/cache plumbing available behind the scenes.
- Added a GitHub Actions-based AA standings refresher that writes directly into Supabase `league_standings`, so the app can use the same standings cache even when Pittsburgh NABA is unreachable from Supabase Edge Functions.
- Switched the Pittsburgh NABA AA parser to scan the full pipe-delimited token stream for the `AA` standings header directly, which is more reliable than regex slicing against the flattened edge response.
- Added a pipe-delimited AA standings parser for the Pittsburgh NABA server response so the Supabase refresh can handle the flattened `|` token stream the live standings page returns at the edge.
- Added a normalized-text fallback for Pittsburgh NABA AA standings parsing so both the Supabase refresh function and the in-app parser can handle flattened server responses instead of only line-broken table text.
- Fixed the Pittsburgh NABA AA standings parser to handle the compact live row format from the league site, which lets the Supabase standings refresh capture real teams like Oakmont Lions instead of failing on the page structure.
- Added a Supabase-backed AA standings path with a new `league_standings` table, app-side cache reads, and an Edge Function scaffold for refreshing Pittsburgh NABA standings server-side so Home standings no longer have to depend on a browser scrape.
- Switched live AA standings refresh to the dedicated Pittsburgh NABA standings page first, so the Home standings card and scouting data have a cleaner source for current AA rows like Oakmont Lions instead of depending on the general league home page layout.
- Switched the Home/Scouting league feed to the Pittsburgh NABA `default.asp` page and changed AA standings parsing to read the live AA table dynamically, so Oakmont Lions and any other current AA teams can flow in from the real league page instead of only from the old baked-in snapshot.
- Added an explicit Oakmont Lions placeholder row to the Home page standings card so the team still appears while the league standings panel is using preseason snapshot data from the league page.
- Combined the Home page batting and pitching snapshots into one centered Team Leaders panel and added a placeholder League Standings panel sourced from the existing league page snapshot so the dashboard feels cleaner before the season starts.
- Removed the built-in seeded demo game from the real app bootstrap and added a cleanup for the legacy `Riverside Hawks` sample so fake games no longer sneak back into the shared archive after fresh loads or deploy-related refreshes.
- Reworked the Stats page for mobile and tablet with a tighter responsive table mode, smaller sticky player column, swipe hint, and fewer low-priority columns on phones so hitting and pitching stats stay readable on smaller screens.
- Removed the dark navy panel treatment from the live Score Game field shell, brightened the score-view field chrome to match the lighter field art, and scoped the live spray chart to the active game only so batted-ball markers no longer carry over from earlier games.
- Added a lightweight completed-game publish retry queue so tapping Sync now survives failed/offline attempts, remembers the pending publish locally, and automatically retries after the device reconnects or an admin session comes back.
- Hardened Supabase game sync so shared bootstrap now merges remote games by ID without wiping local-only games, normal shared sync uses upserts instead of full-snapshot deletes, and game removal issues an explicit targeted delete only for the game an admin intentionally removed.
- Tightened the responsive layout across the app with a broader mobile/tablet pass for page headers, forms, card grids, and especially the Box Score controls, summary, tabs, and tables.
- Anchored the Public View/Admin Sign In/build utility bar to the bottom of the page on mobile and tablet layouts so it no longer floats over the home content.
- Renamed the completed-games section back to Game Archive and removed the extra View Stats action from completed-game cards so the game window stays tighter.
- Added HBP columns to the Stats page for both batting and pitching so hit-by-pitch totals are visible and sortable.
- Updated the Box Score line score to default to 7 innings and only add extra columns when a game actually goes beyond seven.
- Added team logos to the Box Score header cards so Lions and opponent branding now appears above each team name using the supplied logo set.
- Fixed completed-game sync status so Past Games no longer gets stuck showing `Syncing...` after a successful publish, and stale transient sync flags are now normalized back to a stable ready/synced state.
- Added pitcher win/loss/no-decision tracking for completed games using pitcher-of-record logic from the game event history, and expanded the Stats pitching table to show W, L, and ND.
- Simplified Game Archive into Past Games by removing the searchable-notes framing, dropping the search box, and removing the play-by-play preview text from each past-game card.
- Filtered the Stats pitching view down to only players who have actually pitched, added Wins to the pitching leaders/table, and froze the Player column so stats stay readable while horizontally scrolling on desktop and mobile.
- Removed the extra Name and Number row from Roster player cards so the card stays cleaner and the stat section begins immediately below player info.
- Removed SLG from the Roster player stat strip so cards now show AVG, OBP, and OPS with cleaner spacing and better desktop alignment.
- Renamed the homepage header to "Season Overview" and tightened the mobile homepage layout so hero content, leader cards, and action rows scale more cleanly on phones, tablets, and desktop.
- Reworked the bottom utility controls so Public View, Admin Sign In, and the build badge dock cleanly at the bottom on smaller screens instead of floating over page content.
- Restyled the Roster cards with gold player-number pills, the new lion logo as the card watermark, and tighter mobile/tablet scaling for the roster form, toolbar, cards, and edit fields.
- Added a scheduled live-game window for Home and Games so same-day games appear as Live from scheduled start through 2.5 hours later, even before an offline scoring device syncs them back.
- Replaced the Create Game opponent text box with a dropdown populated from the known matchup teams, so scheduling stays consistent with the available opponent artwork.
- Updated matchup artwork selection to use the new `away@home` graphic convention, so homepage and game-card visuals now switch correctly between `Lions @ Opponent` and `Opponent @ Lions`.
- Replaced the homepage/header lion graphic and the default no-opponent game-card fallback image with the new Lions logo asset.
- Shifted Score Game sync to a post-game workflow: active scoring stays local on the iPad, completed games are marked ready to sync, and admins can publish them from the Games view once back online.
- Fixed state normalization so empty saved roster/lineup arrays are treated as missing data and automatically restored from the built-in Lions roster instead of being kept as a blank team.
- Fixed shared roster recovery so empty Supabase roster/lineup data no longer overrides the built-in Lions roster, and approved admin sign-in now heals the shared roster automatically when the backend copy is blank.
- Added a final offline trusted-admin restore path so if the iPad has previously verified an approved admin online, reopening the PWA offline preserves admin mode for scoring instead of falling back to public view.
- Fixed admin session persistence for field use by restoring approved admin mode from the cached Supabase session plus cached approved admin email when the scorer reopens the PWA offline.
- Added a manual `Sync Game` action and visible live-game sync status for Score Game so the scoring iPad can keep working offline and push the current game snapshot to Supabase when reconnected.
- Replaced the frontend-only admin password prompt with Supabase email/password admin sign-in, persisted admin sessions through Supabase Auth, and restricted shared backend writes to approved admin emails.
- Added first-pass shared Supabase writes for roster changes plus scheduled/completed game updates while intentionally leaving in-progress Score Game work local-first for iPad/offline scoring.
- Added a first Supabase read bootstrap so the app still opens from local data immediately, then safely loads shared roster/game data from Supabase in the background when a shared snapshot exists.
- Added the first Supabase backend foundation files, including a browser client config, a local-first shared-storage adapter scaffold, and setup docs/SQL for shared app state and game records.
- Wired the app shell to load the Supabase browser client and refreshed the build/cache so backend foundation changes propagate cleanly across GitHub Pages and installed PWAs.
- Added cache-busting asset versioning for the main HTML/CSS/JS/logo paths and fixed the header logo sizing in markup so live GitHub Pages deploys do not mix new HTML with stale styling.
- Activated GA4 traffic tracking for the live site using the configured measurement ID and refreshed the build/cache for production pickup.
- Replaced the OL header badge with the Lions logo, simplified the top-left brand to Oakmont Lions, moved the build/admin controls into a bottom-left utility bar, and aligned the home pitching leader cards to match batting.
- Added a GA4-ready analytics hook so site traffic tracking can be turned on once a live measurement ID is provided.
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
