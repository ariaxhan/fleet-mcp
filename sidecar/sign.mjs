// Machine request signature (PRD 2.6.4), shared by the sidecar and the suite runner without an import cycle.
import { createHash, randomBytes, sign } from 'node:crypto';

export function signRequest(privateKey, machineId, method, path, body) {
  const ts = String(Date.now()), nonce = randomBytes(18).toString('base64url');
  const msg = `${method}\n${path}\n${createHash('sha256').update(body).digest('hex')}\n${ts}\n${nonce}`;
  return { 'x-fleet-machine': machineId, 'x-fleet-timestamp': ts, 'x-fleet-nonce': nonce,
    'x-fleet-signature': sign(null, Buffer.from(msg), privateKey).toString('base64url'), 'content-type': 'application/json' };
}
