# Trivia Pool

Stake-based, AI-generated trivia game. Winner takes the pot. Built with
Node/Express/Socket.io on the backend and React (Vite) on the frontend.

This is a working MVP for **fake/logged stakes only** — no real payment
processing is wired up yet. See "Next steps" at the bottom for adding that.

## Project structure

```
trivia-pool/
  server/     Express + Socket.io backend, AI question generation, game logic
  client/     React frontend (Home / Host / Player views)
```

## 1. Server setup

```bash
cd server
npm install
cp .env.example .env
```

Open `.env` and add your Anthropic API key:
```
ANTHROPIC_API_KEY=sk-ant-...
```

Run it:
```bash
npm run dev
```
Server starts on http://localhost:4000. You should see:
```
Trivia pool server running on http://localhost:4000
```

## 2. Client setup

Open a **second terminal**:
```bash
cd client
npm install
npm run dev
```
Client starts on http://localhost:5173.

## 3. Try it out

1. Open http://localhost:5173 in one browser tab → click **Host a Pool**
2. Enter a topic (e.g. "90s movies"), stake, question count → **Create Pool**
3. Note the 6-digit code
4. Open http://localhost:5173/play in **two more tabs** (or two other devices
   on the same wifi, using your computer's local IP instead of localhost)
5. Each joins with the code + a name + a stake
6. Back on the host tab, click **Start Game** once 2+ players joined
7. Play through the questions — server AI-generates them live, scores
   answers by speed + correctness, and shows a winner-takes-all payout at
   the end

## How the game loop works

`lobby → question → reveal → (next question) → ... → settled`

- The server holds all game state in memory (see `server/poolManager.js`)
- Correct answers are **never sent to clients** until reveal — check
  `server/socketHandlers.js` for how `pool:question_started` strips the
  answer key before broadcasting
- Timing is measured server-side (`answeredAt - questionStartedAt`), so a
  player's local clock never affects scoring
- If every player answers before the timer runs out, the question closes
  early instead of waiting the full duration

## Testing on your phone (same wifi)

Find your computer's local IP (e.g. `192.168.1.42`), then:
1. In `client/vite.config.js`, Vite already listens on all interfaces by
   default in dev mode — just visit `http://192.168.1.42:5173/play` from
   your phone
2. In `client/src/socket.js`, you may need to set
   `VITE_SERVER_URL=http://192.168.1.42:4000` in a `client/.env` file so the
   phone can reach your server instead of `localhost`

## Next steps (not built yet — by design, per our plan)

- **Real payments**: swap the plain `stakeAmount` number for a real Stripe
  PaymentIntent per player, captured only once the pool locks in
  (`host:start_game`), with payout via Stripe Connect transfer to the
  winner. Talk to a lawyer first about gambling/skill-contest regulations
  in your target region before enabling real money.
- **Reconnect handling**: if a player refreshes mid-game, they currently
  lose their session. Store a persistent player ID in localStorage and let
  them rejoin the same pool + resume their score.
- **Tie-break rule**: current version splits the pot evenly on a tie.
  Add a sudden-death question if you want a single winner instead.
- **Question moderation pass**: run generated questions through a second
  quick validation/moderation check before showing them, in case the model
  produces an ambiguous question.
- **Persistence**: pools are in-memory only — a server restart wipes
  everything. Fine for MVP, add Redis or Postgres before real users depend
  on it.
