import bcrypt from "bcryptjs";
import { Router } from "express";
import {
  createUser,
  getLatestConnection,
  getUserByUsername,
  loginEnabledSaids,
  UserRow,
} from "../db";
import {
  createLoginSession,
  getLoginSession,
} from "../auth/loginSessions";
import { AuthedRequest, requireAuth, signToken } from "../middleware/auth";
import { signifyService } from "../signify/signify.service";

export const authRouter = Router();

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;

function publicUser(user: UserRow) {
  return {
    username: user.username,
    displayName: user.display_name,
    email: user.email,
    role: user.role,
  };
}

/** Self-registration — creates a holder account. */
authRouter.post("/register", (req, res) => {
  const { username, password, displayName, email } = req.body ?? {};

  if (!USERNAME_RE.test(username || "")) {
    return res.status(400).json({
      error: "Username must be 3–32 chars (letters, digits, . _ -).",
    });
  }
  if (typeof password !== "string" || password.length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters." });
  }
  if (!displayName || typeof displayName !== "string") {
    return res.status(400).json({ error: "A display name is required." });
  }
  if (getUserByUsername(username)) {
    return res.status(409).json({ error: "That username is taken." });
  }

  const user = createUser({
    username,
    displayName: displayName.trim(),
    email: (email || "").trim(),
    passwordHash: bcrypt.hashSync(password, 10),
    role: "holder",
  });

  res.json({ token: signToken(user.id), user: publicUser(user) });
});

/** Login — validates against the stored password hash. */
authRouter.post("/login", (req, res) => {
  const { username, password } = req.body ?? {};
  const user = getUserByUsername(username || "");
  if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  res.json({ token: signToken(user.id), user: publicUser(user) });
});

authRouter.get("/me", requireAuth, (req: AuthedRequest, res) => {
  res.json(publicUser(req.user!));
});

/**
 * Log in with a credential — step 1: send a presentation request to the
 * account's wallet. The username only routes the request; the wallet's
 * approval is what authenticates.
 */
authRouter.post("/cred-login/start", async (req, res) => {
  if (!signifyService.isAvailable()) {
    return res.status(503).json({ error: "KERIA agent is not available" });
  }
  const user = getUserByUsername(req.body?.username || "");
  if (!user) return res.status(404).json({ error: "No such account." });

  const connection = getLatestConnection(user.id);
  if (!connection) {
    return res
      .status(400)
      .json({ error: "This account hasn't connected a wallet yet." });
  }

  const saids = loginEnabledSaids();
  if (saids.length === 0) {
    return res.status(400).json({
      error: "The issuer hasn't enabled any credential for login.",
    });
  }

  try {
    const applySaids: string[] = [];
    for (const said of saids) {
      const applySaid = await signifyService.sendPresentation(
        connection.user_aid,
        said
      );
      if (applySaid) applySaids.push(applySaid);
    }
    const session = createLoginSession({
      applySaids,
      userId: user.id,
      expectedAid: connection.user_aid,
    });
    res.json({ sessionId: session.id });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/** Step 2: poll the login session until the wallet presents (or it fails). */
authRouter.get("/cred-login/:id", (req, res) => {
  const s = getLoginSession(req.params.id);
  if (!s) return res.status(404).json({ status: "expired" });
  if (s.status === "success") return res.json({ status: "success", token: s.token });
  if (s.status === "failed") return res.json({ status: "failed", reason: s.reason });
  res.json({ status: "pending" });
});
