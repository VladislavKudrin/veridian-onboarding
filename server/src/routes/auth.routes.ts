import { Router } from "express";
import { config } from "../config";
import { getUserByUsername } from "../db";
import { AuthedRequest, requireAuth, signToken } from "../middleware/auth";

export const authRouter = Router();

/** Mock web2 login — single admin/admin account. */
authRouter.post("/login", (req, res) => {
  const { username, password } = req.body ?? {};

  if (username !== config.admin.username || password !== config.admin.password) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const user = getUserByUsername(username);
  if (!user) {
    return res.status(500).json({ error: "Mock user not seeded" });
  }

  return res.json({
    token: signToken(user.id),
    user: {
      username: user.username,
      displayName: user.display_name,
      email: user.email,
    },
  });
});

authRouter.get("/me", requireAuth, (req: AuthedRequest, res) => {
  const user = req.user!;
  res.json({
    username: user.username,
    displayName: user.display_name,
    email: user.email,
  });
});
