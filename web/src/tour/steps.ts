export type TourRole = "any" | "issuer" | "holder" | "loggedout";

export interface TourStep {
  id: string;
  /** Which context this step belongs to. A mismatch shows a hand-off card. */
  role: TourRole;
  /** data-tour value of the element to spotlight (omit for a centered card). */
  target?: string;
  title: string;
  body: string;
}

/**
 * One continuous journey across both roles. When the next step needs the other
 * role, the tour shows a hand-off card; logging in as that role resumes here.
 */
export const JOURNEY: TourStep[] = [
  {
    id: "intro",
    role: "any",
    title: "Welcome to the Veridian Sandbox",
    body: "Here's the whole loop: an issuer defines a credential, a holder requests it, the issuer approves, it lands in the wallet — and the holder can then log in with it. I'll walk you through all of it, switching between the two roles. Skip anytime.",
  },
  {
    id: "issuer-schemas",
    role: "issuer",
    target: "schemas",
    title: "1 · Define what you issue",
    body: "As the issuer you define credential types (schemas) here — build one from a few fields or import a ready-made one. Each schema also has a 🔑 toggle to allow logging in with that credential. (Open the 💡 and </> panels to see the KERI concept and the code.)",
  },
  {
    id: "to-holder-connect",
    role: "holder",
    target: "prerequisites",
    title: "2 · Now you're the holder",
    body: "Switch hats. A holder connects their Veridian wallet — this card shows this sandbox's boot/connect URLs and how to point a wallet at it.",
  },
  {
    id: "holder-connect",
    role: "holder",
    target: "connect",
    title: "3 · Connect the wallet",
    body: "Step 1 establishes a mutual KERI connection between the wallet and the issuer — a two-way OOBI exchange. No accounts, no blockchain.",
  },
  {
    id: "holder-request",
    role: "holder",
    target: "request",
    title: "4 · Request a credential",
    body: "Once connected, pick a credential type the issuer offers, fill in the details, and submit — it goes to the issuer as a pending request.",
  },
  {
    id: "issuer-requests",
    role: "issuer",
    target: "requests",
    title: "5 · Approve it",
    body: "Back as the issuer, every request lands here. Accept it to mint the ACDC and IPEX-grant it to the holder's wallet — or decline it. You can also revoke an issued credential later.",
  },
  {
    id: "holder-status",
    role: "holder",
    target: "request",
    title: "6 · It arrives",
    body: "As the holder again, your request flips to accepted and the credential is granted to your wallet — accept it from the wallet's notifications.",
  },
  {
    id: "login-cred",
    role: "loggedout",
    target: "wallet-login",
    title: "7 · Log in with the credential",
    body: "Finally, authenticate by presenting it: choose this, enter your username, approve the request in your wallet — no password. (Works for login-enabled schemas only.)",
  },
  {
    id: "done",
    role: "any",
    title: "That's the full loop 🎉",
    body: "Issue → request → approve → present → log in. Re-run this tour anytime from the “?” in the top bar. Now go build with it.",
  },
];

export function handoffInstruction(role: TourRole): string {
  switch (role) {
    case "issuer":
      return "Log out and sign in as the issuer — admin / admin.";
    case "holder":
      return "Log out and sign in as your holder account (or create one).";
    case "loggedout":
      return "Log out to continue.";
    default:
      return "";
  }
}
