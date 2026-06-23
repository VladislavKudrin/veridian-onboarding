# Veridian POC — the ultimate starter

A self-contained, **guided** proof-of-concept for integrating the
[Veridian](https://veridian.id) identity wallet and KERI infrastructure into
your own product. One command brings up the whole stack — agent, witnesses,
issuer backend, and a web UI that walks you through each step and shows the
code behind it — so you can lift the chunks you need into your own app.

## Quick start

After cloning, two steps:

```bash
cp .env.example .env     # add a free ngrok authtoken — see "Wallet reach" below
docker compose up --build
```

That's the whole onboarding — it builds and runs everything. No other
repositories or local Node needed; the agent/witness config is vendored under
`infra/`. The backend waits for KERIA, then logs:

```
[signify] agent "VeridianPoc" ready (AID E…)
```

Then open **http://localhost:5173**, sign in as the issuer with **admin /
admin**, and a **guided tour** starts automatically — follow it end to end
(it hands off between the issuer and holder roles) or replay it anytime from
**? Tour** in the top bar.

| Service       | URL                     | Purpose                                      |
| ------------- | ----------------------- | -------------------------------------------- |
| `web`         | http://localhost:5173   | The guided UI (start here)                   |
| `server`      | http://localhost:4000   | Backend / issuer agent                       |
| `ngrok`       | http://localhost:4040   | Public tunnel for KERIA (OOBI/boot/connect)  |
| `cloudflared` | —                       | Public tunnel for the schema host (no token) |
| `keria`       | http://localhost:3901   | The agent that hosts cloud identifiers       |
| `keria`       | http://localhost:3903   | Boot endpoint (first-run agent bootstrap)    |
| `witnesses`   | http://localhost:5642…7 | 6 demo witnesses that receipt key events     |

> The issuer's seed (`SIGNIFY_BRAN`) is **pinned** by default, so the same
> issuer AID survives restarts (paired with the persistent `keria-data`
> volume). Avoid `docker compose down -v` — `-v` wipes that volume, re-creates
> the agent (new AID), and forces a wallet reconnect. Use `stop` / `down`
> (no `-v`) for routine starts and stops.

## What's inside

A generic **issuer** ("Veridian Sandbox") that hands verifiable credentials to
any holder's wallet — a university, an employer, a government, you name it. Swap
the branding, the schema, and the mock auth and it's your own flow.

```
veridian-poc/
├── docker-compose.yml   The WHOLE stack: infra + server + web
├── infra/               Vendored agent + witness config, tunnels
├── server/              Express + signify-ts agent + SQLite   (port 4000)
└── web/                 Vite + React guided UI                 (port 5173)
```

The full credential lifecycle, each step explained in the UI with a *what's
happening* note and the code that does it:

- **Connection** — mutual OOBI introduction between the issuer and the wallet.
- **Issuer / schemas** — build a custom ACDC schema (or import a bundled/vLEI
  one), saidify it, host it, and resolve it into KERIA.
- **Request → approve** — a holder picks a credential type, fills its
  attributes, and **requests** it; the issuer **accepts** (mints the ACDC and
  IPEX-grants it to the wallet, which admits it) or **declines**.
- **Revocation** — the issuer can revoke an issued credential; the holder sees
  the revoked status.
- **Login with a credential** — designate login-enabled schemas, then sign in
  by presenting a credential from the wallet (no password): the platform sends
  a presentation request, verifies the disclosed credential, and starts a
  session.

Everything below is reference detail — reach for it only when you need it.

---

## Wallet reach — making the wallet find KERIA (OOBI host)

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
  `3902`, and disable the tunnel with `COMPOSE_PROFILES=` (empty).
- **`local`** — internal only; the stack runs but no external wallet can
  connect. Fine for development without a wallet.

The KERIA init script (`infra/keria/entrypoint.sh`) resolves this value and
writes it into KERIA's `curls` before launch.

> **Gotcha:** KERIA bakes the advertised host into the agent at **first boot**
> and persists it. After *changing* `KERIA_PUBLIC_URL`, re-create the agent
> once with `docker compose down -v` so the new host takes effect, then
> reconnect the wallet.

---

## Production-style deployment (Traefik + your domain)

The ngrok path is great for a quick local/phone test, but for a real,
shareable sandbox use the **Traefik overlay** — it mirrors Veridian's own
self-host pattern: one `PUBLIC_DOMAIN` with HTTPS subdomains, a reverse proxy,
and a real public schema host.

```bash
# .env:
#   COMPOSE_PROFILES=traefik
#   PUBLIC_DOMAIN=example.com
#   ACME_ADMIN_EMAIL=you@example.com
docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d --build
```

On a host with a public IP, ports **80 + 443** open, and DNS A-records → this
host for each subdomain, Traefik gets Let's Encrypt certs and routes:

| Subdomain                       | →      | Purpose                                |
| ------------------------------- | ------ | -------------------------------------- |
| `keria.${PUBLIC_DOMAIN}`        | 3901   | connect / admin                        |
| `keria-boot.${PUBLIC_DOMAIN}`   | 3903   | boot                                   |
| `keria-ext.${PUBLIC_DOMAIN}`    | 3902   | curls / OOBI                           |
| `cred-issuance.${PUBLIC_DOMAIN}`| server | **public schema host** (`/oobi/:said`) |
| `app.${PUBLIC_DOMAIN}`          | web    | the guided UI                          |

The overlay derives `KERIA_PUBLIC_URL`, `SCHEMA_PUBLIC_URL`, and the wallet
boot/connect URLs from `PUBLIC_DOMAIN` automatically; ngrok is not used. The
prerequisites card then shows the `keria-boot` / `keria` URLs for the wallet.

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

## Defining what to issue (schemas)

A credential is issued against a **schema**. The **Issuer** console lets you:

- **Build** one from a few fields → the backend generates an ACDC JSON Schema and
  **saidifies** it (`Saider.saidify` — the `$id` is a digest of the content, a
  self-addressing identifier, *not* a key signature), then hosts and resolves it.
- **Import** a bundled/vLEI schema (Foundation Employee, QVI, Legal Entity…)
  verbatim, preserving its SAID.

The server **hosts** every stored schema at unauthenticated `GET /oobi/:said`.
Two parties resolve it: **our** KERIA (to issue) reaches it internally via
`SCHEMA_HOST` (`http://server:4000` / `http://host.docker.internal:4000`); the
**wallet's** KERIA (to *admit*) reaches it via `SCHEMA_PUBLIC_URL` — see below.

Saidification is in `server/src/schema/saidify.ts` (verified to reproduce
keripy's SAIDs exactly).

---

## Reaching the schema from any wallet (grant & presentation)

To **admit** a credential (or answer a presentation request), the wallet's KERIA
must resolve the credential's **schema**. So the schema host has to be reachable
by that KERIA — internal is enough only if the wallet runs on *our* KERIA; for
**any** wallet it must be public. Two pieces make this work, with no domain:

- **A public schema host** — the `cloudflared` service opens a quick tunnel to
  the schema host (no account, token, or domain). The server auto-reads its URL
  from the tunnel log; override with `SCHEMA_PUBLIC_URL` to pin your own.
- **Telling the wallet where the schema is** — the issuer hand-builds the IPEX
  message (the issuance **grant** and the login **apply**) with `exn.a.oobiUrl`
  set to the public schema base, in
  `server/src/signify/signify.service.ts`. The wallet reads that and resolves
  `<oobiUrl>/<said>`. (signify's stock `grant()` / `apply()` can't inject it,
  hence the hand-build — without it the wallet silently drops the message.)

`schemaPublicBase()` (`server/src/schema/publicUrl.ts`) resolves the schema URL:
explicit `SCHEMA_PUBLIC_URL` → the cloudflared tunnel → the internal host. With
a domain, the Traefik overlay sets it to `cred-issuance.${PUBLIC_DOMAIN}`.

---

## Login with a credential (verifiable presentation)

The issuer marks one or more schemas **login-enabled** (🔑 toggle). To sign in,
the holder chooses "Log in with your wallet" and enters a username; the platform
sends an IPEX presentation request (`apply`) to that account's wallet, the
holder approves and presents a credential, and a background poller verifies it —
**login-enabled schema · issued by us · holder AID matches · not revoked** —
before minting the session. See `server/src/signify/signify.service.ts`
(`sendPresentation`), `server/src/auth/credLoginPoller.ts`, and
`server/src/auth/loginSessions.ts`.

---

## API surface

| Method | Path                  | Auth   | Description                                                    |
| ------ | --------------------- | ------ | ------------------------------------------------------------- |
| POST   | `/auth/register`      | —      | Create a holder account                                       |
| POST   | `/auth/login`         | —      | Password login → JWT                                          |
| POST   | `/auth/cred-login/start` | —   | Begin login-with-credential → presentation request           |
| GET    | `/auth/cred-login/:id`| —      | Poll login-with-credential status → JWT on success            |
| GET    | `/auth/me`            | JWT    | Current user                                                  |
| GET    | `/health`             | —      | Server + KERIA agent status                                   |
| GET    | `/info`               | —      | Sandbox info + wallet boot/connect URLs                       |
| GET    | `/oobi/:said`         | —      | Hosted schema OOBI (KERIA/wallet fetches this)                |
| GET    | `/connection/oobi`    | JWT    | Issuer OOBI + AID (for the QR)                                |
| GET    | `/connection`         | JWT    | Connection state, validated vs the live agent (flags `stale`) |
| POST   | `/connection/resolve` | JWT    | Resolve wallet OOBI → connect                                 |
| DELETE | `/connection`         | JWT    | Disconnect / start over                                       |
| GET    | `/schemas`            | JWT    | Schemas you've built/imported (with typed attributes)         |
| GET    | `/schemas/catalog`    | JWT    | Bundled/vLEI schemas to import                                |
| POST   | `/schemas`            | JWT    | Build + saidify + host + resolve                              |
| POST   | `/schemas/import`     | JWT    | Import a catalog schema                                       |
| POST   | `/schemas/:said/login`| Issuer | Toggle whether a schema can be used to log in                 |
| DELETE | `/schemas/:said`      | JWT    | Remove a schema                                               |
| GET    | `/credentials`        | JWT    | Credentials issued to the holder                              |
| GET    | `/requests`           | JWT    | Credential requests (holder's own, or all for the issuer)     |
| POST   | `/requests`           | JWT    | Holder requests a credential                                  |
| POST   | `/requests/:id/accept`| Issuer | Accept → mint ACDC + IPEX-grant to wallet                     |
| POST   | `/requests/:id/decline`| Issuer | Decline a request                                            |
| POST   | `/requests/:id/revoke`| Issuer | Revoke an issued credential                                   |

> This is a POC: simplified error handling and lightweight SQLite storage.
> Authentication is a starting point, not production-hardened.
