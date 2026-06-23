import { getUserById, loginEnabledSaids } from "../db";
import { signToken } from "../middleware/auth";
import { signifyService } from "../signify/signify.service";
import {
  expireOldSessions,
  findByApplySaid,
  patchLoginSession,
} from "./loginSessions";

let started = false;

/** Background loop: on a holder's IPEX offer, verify it and complete login. */
export function startCredLoginPoller(): void {
  if (started) return;
  started = true;
  void loop();
}

async function loop(): Promise<void> {
  for (;;) {
    try {
      if (signifyService.isAvailable()) await tick();
    } catch (e: any) {
      console.warn(`[cred-login] poll error: ${e?.message || e}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function tick(): Promise<void> {
  expireOldSessions();
  for (const notif of await signifyService.listNotifications()) {
    try {
      await processNotif(notif);
    } catch (e: any) {
      console.warn(`[cred-login] notif ${notif?.i}: ${e?.message || e}`);
    }
  }
}

async function processNotif(notif: any): Promise<void> {
  const route = notif?.a?.r;
  if (route !== "/exn/ipex/offer" && route !== "/ipex/offer") return; // leave others
  const said = notif?.a?.d;
  if (!said) return;

  try {
    const offer = await signifyService.getExchange(said);
    const applySaid = offer?.exn?.p; // back-ref to our apply
    const recipient = offer?.exn?.i; // holder AID
    const offerSaid = offer?.exn?.d;

    const session = findByApplySaid(applySaid);
    if (!session) return; // not one of our login attempts

    const fail = (reason: string) =>
      patchLoginSession(session.id, { status: "failed", reason });

    if (!recipient || !offerSaid) return fail("bad-offer");

    const acdc = offer?.exn?.e?.acdc;
    const schemaSaid: string | undefined = acdc?.s;
    const issuerAid: string | undefined = acdc?.i;
    const holderAid: string | undefined = acdc?.a?.i;
    const credId: string | undefined = acdc?.d;

    // 1. accepted login schema?
    if (!schemaSaid || !loginEnabledSaids().includes(schemaSaid)) {
      return fail("schema-not-allowed");
    }
    // 2. issued by us?
    if (!issuerAid || issuerAid !== (await signifyService.getClientAid())) {
      return fail("issuer-mismatch");
    }
    // 3. belongs to the account we challenged?
    if (!holderAid || holderAid !== session.expectedAid) {
      return fail("holder-mismatch");
    }
    // 4. not revoked?
    if (credId && (await signifyService.isCredentialRevoked(credId))) {
      return fail("revoked");
    }

    // Complete the IPEX handshake, then mint the session token.
    await signifyService.agreeToOffer(recipient, offerSaid);
    const user = getUserById(session.userId);
    if (!user) return fail("account-removed");
    patchLoginSession(session.id, { status: "success", token: signToken(user.id) });
  } finally {
    await signifyService.deleteNotification(notif.i).catch(() => {});
  }
}
