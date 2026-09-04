# Trivia Pool — Codebase Audit

## Executive Summary

This is a small, cleanly organized MVP (Express + Socket.io backend, React/Vite frontend, Postgres for accounts). The real-time game loop and UI are well-structured for a prototype. However, the app currently **cannot create user accounts at all** (DB table never gets created) and **cannot generate AI questions with a real API key** (invalid model id) — both would block a real deployment on day one. There's also no test coverage, no rate limiting, weak trust boundaries around client-supplied money/stake values, and an in-memory pool store with no cleanup (memory leak). None of this is architecturally hard to fix — it's a handful of concrete, verifiable defects plus some hardening that's expected before this handles real stakes.

---

## Findings

### 1. `initDb()` is never called — signups/logins fail on a fresh database
- **Severity:** Critical
- **Category:** Correctness
- **File:** `server/db.js:19`, `server/index.js`
- **Description:** `initDb()` creates the `users` table, but it's exported and never invoked anywhere in the app.
- **Why it's a problem:** On a fresh Postgres database, the server boots successfully but the `users` table doesn't exist.
- **Impact:** Every signup/login/reset-password call throws a raw Postgres "relation \"users\" does not exist" error (surfaced as a generic 400), so account creation is completely broken until someone manually runs the `CREATE TABLE` out-of-band.
- **Recommended fix:** Call `await initDb()` during server startup in `index.js`, before `server.listen(...)`.

### 2. Invalid Anthropic model id breaks AI question generation
- **Severity:** Critical
- **Category:** Correctness
- **File:** `server/aiQuestions.js:77`
- **Description:** `model: "claude-sonnet-4-6"` does not correspond to any real/available model.
- **Why it's a problem:** Every call to `requestBatch()` throws (invalid model).
- **Impact:** `generateQuestions()` exhausts all 3 attempts and throws "Only generated 0/N valid questions". `host:start_game` always fails whenever a real API key is set — only the no-API-key fallback path (10 canned questions) is reachable in practice.
- **Recommended fix:** Use a valid, current model id.

### 3. No rate limiting on auth endpoints + unauthenticated password reset
- **Severity:** High
- **Category:** Security
- **File:** `server/index.js:15`, `server/auth.js:68`
- **Description:** `/api/login`, `/api/signup`, and `/api/reset-password` have no rate limiting. `resetPassword` lets anyone who knows/guesses a valid email set a new password with no verification step (acknowledged in a code comment as a known prototype limitation).
- **Why it's a problem:** Login/signup error messages differ enough to confirm whether an email is registered, and with no rate limit an attacker can brute-force passwords or reset any account's password at will.
- **Impact:** Full account-takeover path for any email an attacker can enumerate.
- **Recommended fix:** Add rate limiting middleware to all three routes; add real verification (e.g. emailed reset token) before allowing a password reset.

### 4. `JWT_SECRET` falls back to a hardcoded default
- **Severity:** High
- **Category:** Security
- **File:** `server/auth.js:10`
- **Description:** `const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";` — and `.env.example` doesn't even list `JWT_SECRET`, making it easy to leave unset.
- **Why it's a problem:** If left unset in production, every issued token is signed with a publicly-known string.
- **Impact:** Anyone can forge a valid auth token for any email/displayName and hit `/api/me` or any future authenticated route as that user.
- **Recommended fix:** Throw at boot if `JWT_SECRET` isn't set (no silent fallback); add it to `.env.example`.

### 5. Client-supplied `stakeAmount` is trusted with no validation
- **Severity:** High
- **Category:** Security / Data Integrity
- **File:** `server/poolManager.js:46`
- **Description:** `addPlayer()` computes `stakeAmount: Number(stakeAmount) || pool.entryStake` — only `0`/`NaN` falls back to the pool's entry stake; any other client-supplied number (including negative values) is accepted as-is.
- **Why it's a problem:** A player can join with `stakeAmount = 1000000` to inflate the displayed pot, or a negative number to shrink `totalPot()` and skew payouts, since `settlePool()` divides the pot by winner count using these unvalidated values.
- **Impact:** Broken pot/payout integrity for any pool with real stakes attached.
- **Recommended fix:** Require `stakeAmount === pool.entryStake` server-side (reject the join otherwise), rather than trusting an arbitrary client-supplied number.

### 6. `host:start_game` has no status guard — can be re-triggered mid-game
- **Severity:** Medium
- **Category:** Bug
- **File:** `server/socketHandlers.js:48`
- **Description:** The handler never checks `pool.status !== "open"` before regenerating questions and resetting `currentQuestionIndex`.
- **Why it's a problem:** A double-click, network retry, or malicious host client emitting `host:start_game` twice while the game is already `in_progress` silently restarts the quiz for all connected players.
- **Impact:** Also orphans the original in-flight question timer — the old `setTimeout` still fires later and calls `closeQuestion` against the new question state.
- **Recommended fix:** Return an error via `ack` if `pool.status !== "open"`.

### 7. Players are identified by name, not a stable id
- **Severity:** Medium
- **Category:** Bug
- **File:** `server/poolManager.js:66`, `client/src/screens/PlayerView.jsx`
- **Description:** `publicPlayerList()` keys players by `name`; the client re-identifies "me" and "the winner" via `p.name === name` / `w.name === name` string matches.
- **Why it's a problem:** Two players joining the same pool with the same display name (e.g. both type "Alex") collide — React list keys become duplicate, and the "is this me / did I win" checks can match the wrong player.
- **Impact:** Incorrect UI state (wrong player highlighted as "you" or as the winner) for any pool with a duplicate name.
- **Recommended fix:** Assign a stable server-generated player id at join time; use it for keys and identity checks instead of `name`.

### 8. Settled/abandoned pools are never removed from memory
- **Severity:** Medium
- **Category:** Performance / Reliability
- **File:** `server/socketHandlers.js`
- **Description:** `deletePool()` is only called from the disconnect handler when the host leaves an `"open"` (not-yet-started) pool. Pools that reach `"settled"` via `endGame()`, or whose host disconnects mid-game/after game end, stay in the `Map` forever.
- **Why it's a problem:** No TTL or cleanup job exists for completed pools.
- **Impact:** Unbounded memory growth on a long-running server.
- **Recommended fix:** Add a cleanup step (TTL-based sweep, or delete on `game_ended` after a grace period).

### 9. No server-side bounds on pool creation parameters
- **Severity:** Medium
- **Category:** Input Validation
- **File:** `server/socketHandlers.js:21`
- **Description:** `host:create_pool` accepts `topic`, `entryStake`, `questionCount`, and `timeLimitSec` with no validation or bounds.
- **Why it's a problem:** A client can set `questionCount` to an extreme value (expensive AI generation loop, effectively endless game), `timeLimitSec` to `0` or negative (the question timer fires ~immediately via `setTimeout`), or submit an empty/absurdly long `topic`.
- **Impact:** Cost/DoS exposure on the AI generation call, and broken game timing/UX.
- **Recommended fix:** Clamp/validate all four fields server-side before creating the pool.

### 10. No reconnection/session-resume support for players
- **Severity:** Medium
- **Category:** Reliability
- **File:** `server/index.js` (Socket.io setup), `server/socketHandlers.js` (disconnect handler)
- **Description:** Socket.io assigns a new `socket.id` on reconnect; the old id's disconnect event calls `removePlayer()`, and there's no mechanism to rejoin an in-progress pool with the same identity/score.
- **Why it's a problem:** Any player who refreshes the page or has a flaky connection mid-game permanently loses their spot, score, and stake standing.
- **Impact:** Data loss / unfair game outcomes triggered by ordinary network conditions, with no error surfaced beyond the pool's player list silently shrinking.
- **Recommended fix:** Support session resume via a client-held token that maps back to the same in-pool player record on reconnect.

---

## Top 10 Issues to Address First
1. `initDb()` never called — accounts broken (server/db.js:19)
2. Invalid Anthropic model id — AI generation broken (server/aiQuestions.js:77)
3. No rate limiting + unauthenticated password reset (server/index.js, server/auth.js:68)
4. Hardcoded `JWT_SECRET` fallback (server/auth.js:10)
5. Unvalidated client-supplied `stakeAmount` (server/poolManager.js:46)
6. `host:start_game` re-entrancy / missing status guard (server/socketHandlers.js:48)
7. Players keyed/identified by name, not id (server/poolManager.js:66)
8. Settled pools never garbage-collected (server/socketHandlers.js)
9. No bounds on `questionCount`/`timeLimitSec`/`topic` (server/socketHandlers.js:21)
10. No reconnection support for dropped players

## Quick Wins
- Call `initDb()` at server startup in `index.js` (one line).
- Fix the model id in `aiQuestions.js`.
- Require `JWT_SECRET` to be set (throw at boot if missing) instead of silently defaulting; add it to `.env.example`.
- Clamp `entryStake`, `questionCount`, `timeLimitSec` server-side (min/max) in `host:create_pool`.
- Add a status check (`pool.status !== "open"`) at the top of `host:start_game`.
- Reject duplicate in-pool display names in `player:join`.

## Larger Architectural / Tech Debt Improvements
- Introduce a real player identity (server-generated id) instead of relying on `socket.id`/`name` for both routing and display — needed to support reconnection and fix the name-collision bug.
- Add rate limiting / brute-force protection middleware to the `/api/*` auth routes.
- Add a TTL/reaper for settled or abandoned pools in `poolManager.js`.
- Add automated tests: there is currently **zero test coverage** anywhere in the repo (no `*.test.*` files exist). Prioritize `auth.js` (password rules, token issuance) and `poolManager.js` (scoring, `settlePool` payout math, tie handling) since those hold the core business logic.
- Consider persisting completed game results (the Dashboard "Reports" tab is already a stub for this) rather than losing everything on process restart.

## Reviewed With No Significant Issues
- `client/src/LanguageContext.jsx`, `i18n.js`, `soundEffects.js`, `AnimatedNumber.jsx`, `LoadingScreen.jsx` — self-contained, no correctness or security concerns found.
- CORS configuration (single configurable origin, applied consistently to Express and Socket.io) — reasonable for current scope.
- Password hashing (bcryptjs, cost 10) and minimum-length validation — adequate for an MVP.
- Scoring logic in `closeQuestion`/`settlePool` (`server/socketHandlers.js`, `poolManager.js`) — correct given valid inputs; tie-splitting logic is sound.
