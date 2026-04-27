# Oakmont Lions Scorebook PWA - Project Context

Last updated: 2026-04-27
Current commit: v1.1.15 scoring, storage, lineup, and stat-edit release commit
Current app version: `v.1.1.15`
Current asset build markers: `2026.04.27-build-179`

## Project Overview

This project is the Oakmont Lions baseball scorebook Progressive Web App.

Primary goals:
- score Oakmont Lions games from an iPad in the field
- work offline as a PWA during live scoring
- sync completed games back to the shared site when online
- provide a public read-only site for players, families, and supporters
- provide admin-only scoring and management workflows for coaches

The app remains intentionally local-first for live scoring, with shared cloud sync layered in for public/admin data access.

## Repositories

- QA repo: [LionsScorebookQA](https://github.com/rycoulter/LionsScorebookQA)
- Prod repo: [LionsScorebook](https://github.com/rycoulter/LionsScorebook)

Normal working pattern:
- make and test changes in the shared local workspace
- push approved changes to QA first
- promote approved QA changes to prod

## Live Site

- Production domain: [oakmontlions.com](https://oakmontlions.com)
- Canonical custom domain: `www.oakmontlions.com`
- Hosted with GitHub Pages

## Current Product Split

### Public mode

Public users can view:
- Home
- Schedule & Scores
- Roster
- Stats
- Game Archive
- Box Score
- Scorebook
- Game summaries

Public users cannot:
- create games
- score games
- edit roster or lineups
- access admin-only tools

### Admin mode

Admin users can access:
- Score Game
- Lineup Lab
- Roster management
- Scouting Report
- Analysis
- create, edit, sync, and complete game workflows

Admin access is Supabase-auth backed, not just client-side password gated.

## Auth and Shared Data

### Supabase

Supabase is configured for:
- admin sign-in
- shared games and app state
- public read + admin write model

Current project URL:
- `https://oxtikmowvunvicgvvdqa.supabase.co`

Important:
- frontend uses the publishable key only
- do not expose the service role key in the client

### Admin auth model

Admin mode currently requires:
1. valid Supabase email/password sign-in
2. email present in `public.app_admins`

Offline admin behavior:
- after a verified admin signs in online inside the installed PWA
- the app can restore trusted admin mode offline on that same device

## Storage and Sync Model

### Current storage behavior

The app is still in a hybrid state:
- shared reads/writes use Supabase-backed sync foundations
- live scoring remains local-first on the device, with debounced Supabase resume checkpoints for active games when an admin is online
- roster now has a dedicated `public.roster_players` Supabase table
- `app_state.roster` is still written as a compatibility fallback during the migration

Important current note:
- `supabase-schema.sql` creates and backfills `public.roster_players` from the existing `app_state.roster` JSON
- the app prefers `roster_players` during Supabase bootstrap when rows exist
- roster add/edit/remove/toggle flows still mutate local `state.roster`, then shared sync writes both `roster_players` and the fallback `app_state` row
- roster add/edit/remove/toggle flows now await the shared roster sync and alert admins if Supabase/table/auth rejects the write instead of failing silently
- run the updated schema in each Supabase environment before expecting table writes to persist there

### Live game workflow

Current intended workflow:
1. score the game locally on the iPad/PWA
2. when online as admin, active-game checkpoints are debounced into Supabase so the game can be resumed after reloads or from another admin browser
3. stay offline if needed during the game; local scoring continues to work
4. complete the game locally
5. reconnect later if needed
6. sync/publish the completed game back to the shared site

### Sync philosophy

Live scoring still treats the local iPad/PWA as the source of truth during field work. Mid-game Supabase writes are resume checkpoints, not the final publishing workflow.

Why:
- cleaner field workflow
- reduced risk of losing the active game after refresh, browser restart, or switching QA/prod sessions
- better fit for real baseball scorekeeping

## Key Functional Areas

### Score Game

Current state:
- still local-first and optimized for iPad/PWA use
- uses a top-down field image in `assets/updated-field.png`
- supports spray chart placement, runner markers, substitutions, lineup access, and game actions
- now includes a Lions claw-slash win animation sequence for Lions wins
- tracks RISP event context at plate-appearance start for hitter stats
- top scoring header/status bar includes a selectable Pitcher section for eligible Lions pitching changes, preserving the current game situation and recording the substitution for undo/history
- the live scoring dock is split by batting side: Lions batting shows COUNT / AT BAT / SEASON / View Lineup, while opponent batting shows COUNT / PITCHER / AT BAT with a compact Lineup button for editing the opponent order
- pregame opponent lineup setup can append extra hitters beyond the default nine spots before starting the game
- Pitch Mode has separate Undo Pitch and Undo Play controls; Undo Play restores completed plays from a pre-play full-game snapshot stack, including half-inning changes
- Score Game action buttons outside BALL/STRIKE use a shared `actionFeedback` animation layer for quick press/glow/floating-label confirmation
- Score Game feedback now includes optional `navigator.vibrate` haptics as progressive enhancement only; CSS/JS visual feedback remains the primary confirmation and unsupported devices behave normally
- Scoring runs triggers a team-branded `runScoreFeedback` field overlay with the scoring team logo and combined run count; it is visual-only and uses the already-calculated runs from the scoring path, and the next-batter intro waits until the overlay clears
- selected base-runner actions include `NR` for assigning a non-runner from the Lions lineup; later steals, caught stealing, pickoffs, and runs score to the NR runner on base
- selected base-runner SB/CS/PO actions carry the selected source base and use stable runner identity matching so scored, stolen, caught, or picked-off runners clear from the correct base even after cloned/object-shaped runner state
- runner displays and SB/CS/PO actions reconcile stale base mirrors from the latest completed event's runner advancements before enabling or applying runner actions, which protects live games that already have a stale runner left on a base after a scoring play
- Home next-game card gives admins a direct `Start Game` action for scheduled games and `Score Game` action for already-live games
- active games are included in shared Supabase snapshots with `app_state.active_game_id`; `saveState()` stores pending scoring checkpoints and debounces live-game sync so reloads can resume the current inning/count/bases/batter/pending flow

Important current note:
- the local working tree contains an in-progress score-game presentation redesign
- this is focused on shell/layout polish for iPad and should not change underlying scoring logic

### Roster

Current state:
- public Roster tab is live
- roster cards are player-facing and use handedness/pitcher artwork
- list view is a simplified directory view
- `View Stats` sends users into a player-focused stats mode
- add/edit/remove controls are admin-only

Supported position options now include:
- standard defensive positions
- `INF`
- `OF`
- `Coach`

### Stats

Current state:
- roster handoff uses a player-focused stats mode inside the existing Stats page
- player-focused mode hides the normal team dashboard sections
- player-focused mode shows hitting, pitching, and spray chart for the selected player
- `Show Full Team` returns to the standard team stats experience

Recent stat logic:
- `RISP%` is now live, based on:
  - `rispAB`
  - `rispH`
- format matches batting-average style and uses `--` when there are no RISP at-bats
- Hitting Stats rows now expose a game-level stat editor for admins; saved edits live on `game.hittingStatEdits`, replace that player's scored plate-appearance events for the selected game, and feed season AVG/OBP/SLG/OPS recalculation
- the game-level stat editor accepts optional non-derived count inputs for the trackable hitting/running line, including ROE, E, FC, SAC, DP, GO, LO, FO, SB, CS, and PO
- completed games are available for game-level stat editing even when a player was not in the scored lineup; saving a manual game line counts that game as a GP for that player
- the game-level stat editor also stores manual spray dots per player/game with edit-only result choices (`1B`, `2B`, `3B`, `HR`, `GO`, `LO`, `FO`) so the season spray chart is derived from edited spray locations when present
- Pitching Stats rows now expose a game-level stat editor for admins; saved edits live on `game.pitchingStatEdits`, replace that pitcher's scored defensive events for the selected game, and feed season ERA/WHIP/rate recalculation from IP, pitch count, BF, runs, ER, and decision inputs

### Schedule & Scores / Game Archive / Box Score

Current state:
- public navigation uses `Schedule & Scores` and `Game Archive`
- mobile completed-games view shows all completed games instead of a short "last 3" slice
- box score return copy uses `Back to Archive`
- `View Full Stats` from box score carries the selected game into Stats

### Matchup Artwork and Logos

Matchup images use a home/away-aware naming convention:
- `away@home`

Examples:
- `lions@devils.png`
- `devils@lions.png`

Folders:
- `assets/matchups/`
- `assets/team-logos/`

Recent asset state:
- Eagles and Turtles logos were refreshed
- matchup artwork has been broadly updated to the new visual set

## Pitcher Decision Logic

The app tracks Lions pitcher:
- wins
- losses
- no-decisions

Rule basis:
- MLB glossary and Official Baseball Rules Rule 9.17 framework

Current implementation notes:
- win is assigned using pitcher-of-record logic when Lions take the lead for good
- starter win threshold is adjusted for 7-inning games
- loss is assigned to the Lions pitcher on the opponent go-ahead event that creates the final unrelinquished lead
- pitchers who appeared but received neither a win nor loss are counted as no-decisions

Important limitation:
- the app does not fully model inherited-runner responsibility the way an official scorer would
- relief-win judgment calls are approximated deterministically rather than using subjective scorer judgment

## UI / Visual Direction

Current visual direction:
- dark sports-app shell
- Lions gold + navy identity
- strong iPad and mobile usability
- stable card/control sizing across desktop, tablet, and phone

Current design emphasis:
- cleaner player-facing roster presentation
- simpler public views
- a more cockpit-like Score Game layout for iPad

## Known Constraints and Tradeoffs

1. Live scoring is still local-first.
   - This is intentional.
   - Public/live visibility depends on syncing completed game data back to the site.

2. Pitcher decisions are scorer-like, not scorer-perfect.
   - Especially around relief edge cases and inherited runners.

3. The app is still a single-codebase PWA with progressive backend adoption.
   - Some legacy local-state assumptions still exist in the code.

4. The local working tree may temporarily include in-progress presentation work.
   - Verify current `git status` before treating the local workspace as a released snapshot.

## Current Local Working Snapshot

At the time of this update, the local workspace has uncommitted changes in:
- `app.js`
- `index.html`
- `styles.css`
- `supabase-storage.js`
- `assets/updated-field.png`
- `assets/win-animation/`

Those local changes are primarily tied to:
- ongoing Score Game shell/layout refinement
- field sizing/alignment work
- win animation assets/presentation

## Current Priorities

High-value next areas:
- continue refining the Score Game iPad layout without breaking scoring logic
- keep field sizing and runner-marker alignment stable on the updated field asset
- verify score-game presentation changes against the live in-app browser instead of guessing
- continue hardening completed-game sync behavior
- apply and verify the new `roster_players` schema in QA and Production
- confirm roster edits upsert dedicated table rows while preserving lineup and live scoring state

## Working Conventions

- review current code before changing files
- preserve scoring logic unless explicitly requested
- preserve storage format and PWA setup unless intentionally changing architecture
- make focused, safe changes
- evaluate live UI behavior when repeated CSS/layout changes stop behaving predictably
- add release notes for meaningful shipped changes
- bump app/service worker versions when needed for live refreshes

## Notes for Future Updates

This file should be updated when any of the following change:
- deployment architecture
- auth model
- sync model
- major UI navigation structure
- storage or data ownership rules
- major scoring or stat logic assumptions
- major in-progress local redesign work that changes how the team should resume

This file is meant to be a stable project snapshot, not a full changelog.
Use `RELEASE_NOTES.md` for user-facing release history.
