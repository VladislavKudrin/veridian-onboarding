import {
  EventResult,
  randomPasscode,
  ready,
  Serder,
  SignifyClient,
  Tier,
} from "signify-ts";
import { config } from "../config";
import {
  getAidFromOobi,
  getCredentialIdsByEmail,
  getEndRoles,
  getRegistry,
  waitOperation,
} from "./signify.utils";

export interface IssueCredentialInput {
  userAid: string;
  email: string;
  firstName: string;
  lastName: string;
}

/**
 * Holds the long-lived platform agent (a Signify client connected to KERIA).
 * Ported and slimmed from chalmuns-cantina-backend's SignifyService.
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
      const result: EventResult = await this.client
        .identifiers()
        .create(config.keria.agentName);
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

  async hasActiveCredentials(email: string): Promise<boolean> {
    const issuerAid = await this.getClientAid();
    const ids = await getCredentialIdsByEmail(
      this.client,
      email,
      config.schema.said,
      issuerAid,
      false
    );
    return ids.length > 0;
  }

  /** Issue the ACDC and IPEX-grant it to the user's AID (-> wallet notification). */
  async issueCredentials(input: IssueCredentialInput): Promise<{ said: string }> {
    const client = this.client;
    const name = config.keria.agentName;
    const schemaSaid = config.schema.said;
    const regk = await getRegistry(client, name);
    const issuerAid = await this.getClientAid();

    const existing = await getCredentialIdsByEmail(
      client,
      input.email,
      schemaSaid,
      issuerAid,
      false
    );
    if (existing.length > 0) {
      throw new Error("User already has a valid credential");
    }

    const result = await client.credentials().issue(name, {
      ri: regk,
      s: schemaSaid,
      a: {
        i: input.userAid,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
      },
    });
    await waitOperation(client, result.op);

    const credential = await client.credentials().get(result.acdc.ked.d);
    const datetime = new Date().toISOString().replace("Z", "000+00:00");

    const [grant, gsigs, gend] = await client.ipex().grant({
      senderName: name,
      recipient: input.userAid,
      acdc: new Serder(credential.sad),
      anc: new Serder(credential.anc),
      iss: new Serder(credential.iss),
      ancAttachment: credential.ancatc?.[0],
      datetime,
    });

    await client
      .ipex()
      .submitGrant(name, grant, gsigs, gend, [input.userAid]);

    return { said: credential.sad.d };
  }
}

export const signifyService = new SignifyService();
