import {
  b,
  d,
  EventResult,
  messagize,
  randomPasscode,
  ready,
  serializeACDCAttachment,
  serializeIssExnAttachment,
  Serder,
  Siger,
  SignifyClient,
  Tier,
} from "signify-ts";
import { config } from "../config";
import { schemaPublicBase } from "../schema/publicUrl";
import {
  getAidFromOobi,
  getEndRoles,
  getRegistry,
  waitOperation,
} from "./signify.utils";

export interface IssueCredentialInput {
  userAid: string;
  schemaSaid: string;
  attributes: Record<string, unknown>;
}

/**
 * Holds the long-lived platform agent (a Signify client connected to KERIA).
 */
class SignifyService {
  private client!: SignifyClient;
  private available = false;

  isAvailable(): boolean {
    return this.available;
  }

  getClient(): SignifyClient {
    if (!this.available) throw new Error("KERIA agent is not available");
    return this.client;
  }

  /** Boot/connect the agent and ensure identifier, roles, registry & schema. */
  async init(): Promise<void> {
    if (!config.keria.enabled) {
      console.log("[signify] KERIA disabled — agent will not start.");
      return;
    }

    try {
      await ready();

      this.client = await this.buildClient();
      await this.connect();
      await this.ensureIdentifier();
      await this.ensureRoles();
      await this.ensureRegistry();
      await this.resolveSchema(); // best-effort — non-fatal for the connection chunk

      this.available = true;
      console.log(
        `[signify] agent "${config.keria.agentName}" ready (AID ${await this.getClientAid()})`
      );
    } catch (err) {
      console.error("[signify] init failed:", err);
    }
  }

  private async buildClient(): Promise<SignifyClient> {
    let bran = config.keria.bran ?? randomPasscode();
    bran = bran.padEnd(21, "_").slice(0, 21);

    if (!config.keria.bran) {
      console.warn(
        `[signify] No SIGNIFY_BRAN set — generated an ephemeral one: ${bran}\n` +
          "          Set SIGNIFY_BRAN in .env to keep the same AID across restarts."
      );
    }

    return new SignifyClient(
      config.keria.connectUrl,
      bran,
      Tier.low,
      config.keria.bootUrl
    );
  }

  /**
   * Connect to KERIA, booting the agent on first run. Retries so the server
   * can start before KERIA is ready (e.g. `docker compose up` ordering).
   */
  private async connect(maxAttempts = 30, delayMs = 2000): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        try {
          await this.client.connect();
        } catch {
          const res = await this.client.boot();
          if (!res.ok) throw new Error("KERIA boot failed");
          // Give the freshly-booted agent a moment before connecting.
          await new Promise((r) => setTimeout(r, 3000));
          await this.client.connect();
        }
        console.log("[signify] connected to KERIA");
        return;
      } catch (e: any) {
        console.warn(
          `[signify] KERIA not ready (attempt ${attempt}/${maxAttempts}): ${e.message || e}`
        );
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    throw new Error("Could not connect to KERIA after multiple attempts");
  }

  private async ensureIdentifier(): Promise<void> {
    try {
      await this.client.identifiers().get(config.keria.agentName);
    } catch {
      // Pass a FIXED bran so the issuer AID is deterministic — it then survives
      // a `down -v` / fresh agent instead of rotating (a rotated issuer AID
      // silently breaks every wallet connection, since the wallet drops grants
      // from a sender it no longer recognizes).
      const result: EventResult = await this.client
        .identifiers()
        .create(config.keria.agentName, {
          bran: config.keria.identifierBran,
        });
      await waitOperation(this.client, await result.op());
    }
  }

  private async ensureRoles(): Promise<void> {
    const name = config.keria.agentName;
    const roles = await getEndRoles(this.client, name);

    if (!roles.some((r) => r.role === "agent")) {
      await this.client
        .identifiers()
        .addEndRole(name, "agent", this.client.agent!.pre);
    }

    if (!roles.some((r) => r.role === "indexer")) {
      const prefix = (await this.client.identifiers().get(name)).prefix;
      const result = await this.client
        .identifiers()
        .addEndRole(name, "indexer", prefix);
      await waitOperation(this.client, await result.op());
    }

    // (The wallet learns the schema host from the grant's `oobiUrl` instead of
    // an indexer loc-scheme — see grantWithSchemaOobi.)
  }

  private async ensureRegistry(): Promise<void> {
    try {
      await getRegistry(this.client, config.keria.agentName);
    } catch (e: any) {
      if (String(e.message).includes("Registries not found")) {
        const result = await this.client
          .registries()
          .create({ name: config.keria.agentName, registryName: "veridianPoc" });
        await waitOperation(this.client, await result.op());
      } else {
        throw e;
      }
    }
  }

  /**
   * Resolve the credential schema OOBI so KERIA can validate issued ACDCs.
   * Best-effort: the connection chunk doesn't need a schema, so an empty URL
   * skips it and a failure is logged but never blocks the agent.
   */
  private async resolveSchema(retries = 6, delayMs = 5000): Promise<void> {
    const url = config.schema.oobiUrl;
    if (!url) {
      console.log(
        "[signify] no SCHEMA_OOBI_URL set — skipping schema resolution " +
          "(add it with the issuance chunk)."
      );
      return;
    }
    for (let i = 0; i < retries; i++) {
      try {
        const op = await this.client.oobis().resolve(url);
        await waitOperation(this.client, op);
        console.log(`[signify] resolved schema OOBI: ${url}`);
        return;
      } catch (e: any) {
        console.warn(
          `[signify] schema resolve ${i + 1}/${retries} failed: ${e.message || e}`
        );
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    console.warn(
      `[signify] could not resolve schema OOBI after ${retries} tries (${url}) — ` +
        "continuing; issuance will fail until it's reachable."
    );
  }

  /**
   * Resolve a schema OOBI we host ourselves (GET /oobi/:said) into KERIA, so the
   * agent can validate credentials issued against it. Throws on failure.
   */
  async resolveSchemaSaid(said: string): Promise<void> {
    // Idempotent: if KERIA already has the schema, re-resolving the OOBI errors,
    // so just stop here.
    try {
      await this.client.schemas().get(said);
      return;
    } catch {
      /* not loaded yet — resolve it below */
    }

    const url = `${config.schema.host}/oobi/${said}`;
    const op = await this.client.oobis().resolve(url);
    await waitOperation(this.client, op); // throws on a real resolve failure
    // Confirm it truly loaded (a resolve can "complete" without loading it).
    await this.client.schemas().get(said);
    console.log(`[signify] resolved schema OOBI: ${url}`);
  }

  /** The platform agent's OOBI — shown to the user's wallet as a QR to scan. */
  async getClientOobi(): Promise<string> {
    const oobi = await this.client
      .oobis()
      .get(config.keria.agentName, "agent");
    return `${oobi.oobis[0]}?name=Veridian%20POC`;
  }

  async getClientAid(): Promise<string> {
    const id = await this.client.identifiers().get(config.keria.agentName);
    return id.prefix;
  }

  /** Whether the live agent has resolved (knows) this AID as a contact. */
  async hasContact(aid: string): Promise<boolean> {
    try {
      const contact = await this.client.contacts().get(aid);
      return !!contact;
    } catch {
      return false;
    }
  }

  /** Forget a contact so the connection can be re-established from scratch. */
  async removeContact(aid: string): Promise<void> {
    try {
      await this.client.contacts().delete(aid);
    } catch {
      /* already gone — ignore */
    }
  }

  /** Resolve the user's wallet OOBI (their side of the connection). */
  async resolveUserOobi(oobi: string): Promise<{ userAid: string }> {
    if (!oobi.includes("/oobi/")) {
      throw new Error("Invalid OOBI format");
    }
    const { userAid } = getAidFromOobi(oobi);
    const op = await this.client.oobis().resolve(oobi);
    await waitOperation(this.client, op);
    return { userAid };
  }

  /**
   * Issue an ACDC against the given schema with arbitrary attributes, then
   * IPEX-grant it to the user's AID (-> arrives as a wallet notification).
   */
  async issueCredentials(input: IssueCredentialInput): Promise<{ said: string }> {
    const client = this.client;
    const name = config.keria.agentName;
    const regk = await getRegistry(client, name);

    const result = await client.credentials().issue(name, {
      ri: regk,
      s: input.schemaSaid,
      a: {
        i: input.userAid,
        ...input.attributes,
      },
    });
    await waitOperation(client, result.op);

    const credential = await client.credentials().get(result.acdc.ked.d);
    const datetime = new Date().toISOString().replace("Z", "000+00:00");

    const [grant, gsigs, gend] = await this.grantWithSchemaOobi({
      senderName: name,
      recipient: input.userAid,
      acdc: new Serder(credential.sad),
      anc: new Serder(credential.anc),
      iss: new Serder(credential.iss),
      ancAttachment: credential.ancatc?.[0],
      datetime,
    });

    // Fire-and-forget: KERIA's background sender forwards the grant to the
    // recipient's mailbox off the back of the `exchange.{said}` operation it
    // creates here. Do NOT waitOperation on it — that deletes the operation and
    // cancels the forward before it's delivered (the op reports done:true once
    // the exn is merely saved, not once it's delivered).
    await client
      .ipex()
      .submitGrant(name, grant, gsigs, gend, [input.userAid]);

    return { said: credential.sad.d };
  }

  /**
   * Send a presentation request (IPEX apply) to a wallet AID for a credential
   * of the given schema. Returns the apply's SAID, used to correlate the reply.
   */
  async sendPresentation(aid: string, schemaSaid: string): Promise<string> {
    const name = config.keria.agentName;
    const client: any = this.client;
    const hab = await client.identifiers().get(name);

    // Hand-build the apply so we can include `oobiUrl` (signify's apply() can't):
    // without it the wallet can't resolve the request's schema and silently
    // drops the notification. `a` is the (empty) attribute filter; `oobiUrl`
    // sits alongside it for the wallet's getInlineSchemaOobiBase().
    const data = {
      m: "",
      s: schemaSaid,
      a: {},
      oobiUrl: `${schemaPublicBase()}/oobi`,
    };
    const [apply, sigs] = await client
      .exchanges()
      .createExchangeMessage(hab, "/ipex/apply", data, {}, aid, undefined, undefined);

    // submitApply returns a long-running delivery op — wait for it, otherwise
    // the request never actually reaches the wallet.
    const op = await client.ipex().submitApply(name, apply, sigs, [aid]);
    await waitOperation(this.client, op);
    return (
      (apply as any).sad?.d ??
      (apply as any).ked?.d ??
      (apply as any).exn?.d ??
      ""
    );
  }

  /** Agree to a holder's IPEX offer (completes the presentation handshake). */
  async agreeToOffer(recipient: string, offerSaid: string): Promise<void> {
    const name = config.keria.agentName;
    const [agree, sigs] = await this.client
      .ipex()
      .agree({ senderName: name, recipient, offerSaid });
    const op = await this.client
      .ipex()
      .submitAgree(name, agree, sigs, [recipient]);
    await waitOperation(this.client, op);
  }

  /** Live notifications for the agent (used by the login poller). */
  async listNotifications(): Promise<any[]> {
    const res = await this.client.notifications().list();
    return res?.notes ?? [];
  }

  async getExchange(said: string): Promise<any> {
    return this.client.exchanges().get(said);
  }

  async deleteNotification(id: string): Promise<void> {
    await this.client.notifications().delete(id);
  }

  /** True if KERIA reports this credential as revoked (TEL status `1`). */
  async isCredentialRevoked(credId: string): Promise<boolean> {
    try {
      const cred = await this.client.credentials().get(credId);
      return cred?.status?.s === "1";
    } catch {
      return false;
    }
  }

  /** Revoke a credential — writes a `rev` event to the registry (TEL). */
  async revokeCredential(credSaid: string): Promise<void> {
    const result = await this.client
      .credentials()
      .revoke(config.keria.agentName, credSaid);
    await waitOperation(this.client, result.op);
  }

  /**
   * Build an IPEX grant exactly like signify's `ipex().grant()`, but inject
   * `a.oobiUrl` so the holder's wallet knows where to fetch the credential's
   * schema (the wallet reads `exn.a.oobiUrl` first, before falling back to the
   * issuer's indexer loc-scheme — which our stack can't set).
   */
  private async grantWithSchemaOobi(opts: {
    senderName: string;
    recipient: string;
    acdc: Serder;
    anc: Serder;
    iss: Serder;
    ancAttachment?: string;
    datetime: string;
  }): Promise<[Serder, string[], string]> {
    const client: any = this.client;
    const hab = await client.identifiers().get(opts.senderName);

    let atc = opts.ancAttachment;
    if (atc === undefined) {
      const keeper = client.manager.get(hab);
      const sigs: string[] = await keeper.sign(b(opts.anc.raw));
      const sigers = sigs.map((sig) => new Siger({ qb64: sig }));
      const ims = d(messagize(opts.anc, sigers));
      atc = ims.substring(opts.anc.size);
    }
    const acdcAtc = d(serializeACDCAttachment(opts.iss));
    const issAtc = d(serializeIssExnAttachment(opts.anc));

    const embeds = {
      acdc: [opts.acdc, acdcAtc],
      iss: [opts.iss, issAtc],
      anc: [opts.anc, atc],
    };

    // `oobiUrl` is the schema host base; the wallet appends `/<said>`.
    const data = { m: "", oobiUrl: `${schemaPublicBase()}/oobi` };

    return client
      .exchanges()
      .createExchangeMessage(
        hab,
        "/ipex/grant",
        data,
        embeds,
        opts.recipient,
        opts.datetime,
        undefined
      );
  }
}

export const signifyService = new SignifyService();
