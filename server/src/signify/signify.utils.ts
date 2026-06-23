import { Operation, SignifyClient } from "signify-ts";

/** Wait for a KERIA long-running operation to complete, then clean it up. */
export async function waitOperation<T = any>(
  client: SignifyClient,
  op: Operation<T> | string,
  signal?: AbortSignal
): Promise<Operation<T>> {
  if (typeof op === "string") {
    op = await client.operations().get(op);
  }

  op = await client
    .operations()
    .wait(op, { signal: signal ?? AbortSignal.timeout(30000) });

  await deleteOperations(client, op);

  // A completed operation can still carry a failure (e.g. a rejected OOBI).
  // Surface it instead of silently reporting success.
  const err = (op as any).error;
  if (err) {
    throw new Error(err.message || `Operation ${op.name} failed`);
  }
  return op;
}

async function deleteOperations<T = any>(
  client: SignifyClient,
  op: Operation<T>
): Promise<void> {
  if (op.metadata?.depends) {
    await deleteOperations(client, op.metadata.depends);
  }
  await client.operations().delete(op.name);
}

export async function getEndRoles(
  client: SignifyClient,
  alias: string,
  role?: string
): Promise<any[]> {
  const path =
    role !== undefined
      ? `/identifiers/${alias}/endroles/${role}`
      : `/identifiers/${alias}/endroles`;
  const response: Response = await client.fetch(path, "GET", null);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function getRegistry(
  client: SignifyClient,
  alias: string
): Promise<string> {
  const registries = await client.registries().list(alias);
  if (!registries || registries.length === 0) {
    throw new Error(`Registries not found: ${alias}`);
  }
  return registries[0].regk;
}

/**
 * Parse a Veridian wallet OOBI of the shape
 *   /oobi/{userAid}/agent/{agentAid}
 * and return the identifier (issuee) AID.
 */
export function getAidFromOobi(oobiUrl: string): {
  userAid: string;
  agentAid: string;
} {
  const url = new URL(oobiUrl);
  const parts = url.pathname.split("/").filter(Boolean);

  if (parts.length < 4 || parts[0] !== "oobi" || parts[2] !== "agent") {
    throw new Error(`Invalid OOBI URL: ${oobiUrl}`);
  }

  return { userAid: parts[1], agentAid: parts[3] };
}

/**
 * Return SAIDs of credentials issued to `email` under `schema` by `issuerAid`.
 * `revoked = false` -> only currently-valid (non-revoked) credentials.
 */
export async function getCredentialIdsByEmail(
  client: SignifyClient,
  email: string,
  schema: string,
  issuerAid: string,
  revoked: boolean
): Promise<string[]> {
  const creds = await client.credentials().list();
  return creds
    .filter((c: any) => {
      const matches =
        c.sad?.a?.email === email &&
        c.sad?.i === issuerAid &&
        c.sad?.s === schema;
      return revoked ? matches && c.rev !== null : matches && c.rev === null;
    })
    .map((c: any) => c.sad.d);
}
