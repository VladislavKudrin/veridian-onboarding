import bcrypt from "bcryptjs";
import { Router } from "express";
import { createUser, getUserByUsername, UserRow } from "../db";
import { AuthedRequest, requireAuth, signToken } from "../middleware/auth";

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
