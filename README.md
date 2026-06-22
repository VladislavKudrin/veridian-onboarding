# Veridian POC — the ultimate starter

A self-contained, **guided** proof-of-concept for integrating the
[Veridian](https://veridian.id) identity wallet and KERI infrastructure into
your own product. Spin up the infra with one command, log in, and walk through
each step of the flow with an explanation of *what's happening under the hood*
— so you can lift the chunks you need into your own app.

It ships as a generic **issuer** ("Veridian Sandbox") that hands a verifiable
credential to any holder's wallet — a university, an employer, a government, you
name it. Swap the branding, the schema, and the mock auth and it's your own
flow.

```
veridian-poc/
├── docker-compose.yml   The WHOLE stack: infra + server + web
├── infra/keria-config/  Vendored agent + witness config
├── server/              Express + signify-ts agent + SQLite   (port 4000)
└── web/                 Vite + React guided UI                 (port 5173)
```

We build it in **chunks**. Done so far:

- ✅ **Connection** — mutual OOBI introduction between the issuer and the wallet.
- ✅ **Issuer / schemas** — an Issuer tab to build a custom ACDC schema (or
  import a bundled/vLEI one), saidify it, host it, and resolve it into KERIA.
- ⬜ **Issuance** — issue an ACDC credential and IPEX-grant it to the wallet (next).

---

## Quick start — one command

```bash
cp .env.example .env     # then add your ngrok authtoken (see below)
docker compose up --build
```

That's the whole onboarding. It builds and runs everything:

| Service     | URL                     | Purpose                                    |
| ----------- | ----------------------- | ------------------------------------------ |
| `web`       | http://localhost:5173   | The guided UI (start here)                 |
| `server`    | http://localhost:4000   | Backend / platform agent                   |
| `ngrok`     | http://localhost:4040   | Public tunnel + inspection UI              |
| `keria`     | http://localhost:3901   | The agent that hosts cloud identifiers     |
| `keria`     | http://localhost:3903   | Boot endpoint (first-run agent bootstrap)  |
| `witnesses` | http://localhost:5642…7 | 6 demo witnesses that receipt key events   |

No other repositories or local Node required — agent/witness config is vendored
under `infra/keria-config/`. The backend waits for KERIA to come up, then logs:

```
[signify] agent "VeridianPoc" ready (AID E…)
```

Open **http://localhost:5173** and jump to *Walk the guided flow* below.

> The issuer's seed (`SIGNIFY_BRAN`) is **pinned** by default, so the same
> issuer AID survives restarts (paired with the persistent `keria-data`
> volume). Avoid `docker compose down -v` — `-v` wipes that volume, re-creates
> the agent (new AID), and forces a wallet reconnect. Use `stop` / `down`
> (no `-v`) for routine starts and stops.

---

## Making the wallet reach KERIA (OOBI host)

The OOBI a wallet scans is just a **URL the wallet must fetch**. A local-only
stack advertises Docker-internal hostnames, so a wallet (e.g. the Veridian
mobile app) can't reach it and the connection stays **pending forever**. There
is no "accept" step on the platform — the wallet confirms automatically *once it
finishes resolving our OOBI*. So the OOBI must point at a reachable host.

Configured in `.env` via `KERIA_PUBLIC_URL` (+ `NGROK_AUTHTOKEN`):

- **`ngrok` (default, zero-config)** — opens an ngrok tunnel automatically and
  advertises its public URL in OOBIs. No domain of your own needed; add a free
  token from [ngrok](https://dashboard.ngrok.com/get-started/your-authtoken).
  ⚠️ A **free random** URL changes on every restart, so a saved wallet
  connection breaks each time — fine for a quick test, not for ongoing use.
- **`ngrok` + reserved domain (recommended)** — reserve a static domain at
  <https://dashboard.ngrok.com/domains>, then set **both** (mind the
  `https://`):

  ```
  KERIA_PUBLIC_URL=https://your-name.ngrok-free.dev
  NGROK_DOMAIN=your-name.ngrok-free.dev
  ```

  The URL never changes, so the wallet connection survives restarts.
- **Your own domain (no tunnel)** — set
  `KERIA_PUBLIC_URL=https://keria.yourdomain.org`, point it at this host's port
  `3902`, and disable the tunnel with `COMPOSE_PROFILES=` (empty). How a
  production deployment (like the chalmuns reference) hosts it.
- **`local`** — internal only; the stack runs but no external wallet can
  connect. Fine for development without a wallet.

The KERIA init script (`infra/keria/entrypoint.sh`) resolves this value and
writes it into KERIA's `curls` before launch.

> **Gotcha:** KERIA bakes the advertised host into the agent at **first boot**
> and persists it. After *changing* `KERIA_PUBLIC_URL`, re-create the agent
> once with `docker compose down -v` so the new host takes effect, then
> reconnect the wallet.

---

## Alternative — run the app locally (hot reload)

Handy while editing code: instant Vite HMR + `ts-node-dev` restarts, no image
rebuilds. Run just the **infra** in Docker, the app on your host:

```bash
docker compose up -d keria witnesses ngrok   # infra only (ngrok for wallet reach)

cd server && cp .env.example .env && npm install && npm run dev   # :4000
cd web && npm install && npm run dev                              # :5173 (Vite proxies /api)
```

> **Don't run the host app and the Docker app at once** — both bind `:4000`
> and `:5173`. Coming from a full `docker compose up`? Free those ports first
> with `docker compose stop server web` (this keeps the infra running). To go
> back to full-docker later, `docker compose up -d`.

---

## Walk the guided flow

1. Open http://localhost:5173 and sign in with **admin / admin**.
2. **Step 1 — Connect your wallet.** The page guides you through both halves of
   the introduction, each with an expandable "💡 what's happening" note and the
   API call it triggers:
   - **A** — scan the issuer's OOBI QR into your Veridian wallet.
   - **B** — give your wallet's OOBI back (scan it with your camera or paste
     the link), then **Establish Connection**.
3. Once connected, the resolved wallet AID is shown and Step 2 (issuance)
   unlocks in the next chunk.

---

## How the connection works (the concept you're lifting)

A Veridian connection is a **mutual OOBI resolution** — no accounts, no
blockchain:

- An **OOBI** (Out-Of-Band Introduction) is a discovery URL pointing at an
  **AID** (Autonomic Identifier). Resolving it fetches and verifies that
  identifier's signed key state from its witnesses.
- The wallet resolves the **issuer's** OOBI → it can now verify anything the
  issuer signs.
- The issuer resolves the **wallet's** OOBI → it learns the AID to send the
  credential to later.

The relevant server code lives in `server/src/signify/` (`getClientOobi`,
`resolveUserOobi`) and `server/src/routes/connection.routes.ts`.

---

## Defining what to issue (the Issuer tab)

A credential is issued against a **schema**. The **Issuer** tab lets you:

- **Build** one from a few fields → the backend generates an ACDC JSON Schema and
  **saidifies** it (`Saider.saidify` — the `$id` is a digest of the content, a
  self-addressing identifier, *not* a key signature), then hosts and resolves it.
- **Import** a bundled/vLEI schema (Foundation Employee, QVI, Legal Entity…)
  verbatim, preserving its SAID.

The server **hosts** every stored schema at unauthenticated `GET /oobi/:said` and
resolves it into KERIA. That OOBI only needs to be reachable by **KERIA** (not the
wallet), so it uses `SCHEMA_HOST` — `http://server:4000` in full-docker,
`http://host.docker.internal:4000` in host-dev. No ngrok needed for schemas.

Saidification is in `server/src/schema/saidify.ts` (verified to reproduce
keripy's SAIDs exactly).

---

## API surface

| Method | Path                  | Auth | Description                          |
| ------ | --------------------- | ---- | ----------------------------------- |
| POST   | `/auth/login`         | —    | Mock login → JWT                    |
| GET    | `/auth/me`            | JWT  | Current user                        |
| GET    | `/health`             | —    | Server + KERIA agent status         |
| GET    | `/oobi/:said`         | —    | Hosted schema OOBI (KERIA fetches this) |
| GET    | `/connection/oobi`    | JWT  | Issuer OOBI + AID (for the QR)      |
| GET    | `/connection`         | JWT  | Connection state, validated vs the live agent (flags `stale`) |
| POST   | `/connection/resolve` | JWT  | Resolve wallet OOBI → connect       |
| DELETE | `/connection`         | JWT  | Disconnect / start over             |
| GET    | `/schemas`            | JWT  | Schemas you've built/imported       |
| GET    | `/schemas/catalog`    | JWT  | Bundled/vLEI schemas to import      |
| POST   | `/schemas`            | JWT  | Build + saidify + host + resolve    |
| POST   | `/schemas/import`     | JWT  | Import a catalog schema             |
| DELETE | `/schemas/:said`      | JWT  | Remove a schema                     |

---

## Notes

- The signify integration is adapted from `chalmuns-cantina-backend`, slimmed
  into a framework-agnostic service.
- This is a POC: a single mock user, simplified error handling.
