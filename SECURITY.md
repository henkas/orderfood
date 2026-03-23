# Security Policy

## Reporting vulnerabilities

**Do not open a public GitHub issue for security vulnerabilities.**

Please use [GitHub's private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability) for this repository. This ensures the issue can be reviewed and patched before public disclosure.

Include in your report:
- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept (if safe to share)
- Any suggested mitigations you have identified

You can expect an acknowledgement within 72 hours and a status update within 7 days.

---

## Credential storage

OrderFood stores platform credentials (access tokens and refresh tokens) encrypted on disk.

**Storage location:** `~/.orderfood/{platform}.json`

**Encryption:**
- Algorithm: AES-256-GCM (authenticated encryption — provides both confidentiality and integrity)
- Key derivation: HKDF-SHA256
  - Input key material: machine ID from `node-machine-id` (hex string, unique per device)
  - Salt: static string `"orderfood-v1"`
  - Info: platform name (`"ubereats"` or `"thuisbezorgd"`)
  - Output: 32 bytes
- IV: 12-byte random nonce, freshly generated on each write, stored alongside the ciphertext

This means credentials are bound to the machine they were set up on. Copying `~/.orderfood/` to another machine will not work — you must re-run `npx orderfood setup` on the new machine.

**What is stored:**
```json
{
  "iv": "<base64 nonce>",
  "ciphertext": "<base64 AES-256-GCM encrypted JSON>",
  "user_id": "<plaintext, used for logging only>"
}
```
The decrypted payload contains `access_token`, `refresh_token`, and `expires_at`. No passwords are stored.

**Recommendations:**
- Ensure `~/.orderfood/` is not world-readable (`chmod 700 ~/.orderfood` is set automatically by the setup CLI)
- Do not share or back up `~/.orderfood/` to untrusted locations
- If you believe your tokens have been compromised, revoke them via the platform's official app or website and re-run setup

---

## Scope

This tool automates food delivery ordering using **your own credentials** on **your own account**. It is designed for personal use and open-source research.

In scope for security reports:
- Vulnerabilities in credential encryption or key derivation
- Vulnerabilities in the MCP server that could allow an untrusted MCP client to escalate privileges or access credentials
- Token leakage in logs, error messages, or other output
- Injection vulnerabilities (e.g. malicious restaurant names affecting downstream behavior)

---

## Threat model

### What this protects against

- **Credential theft via filesystem read** — tokens are AES-256-GCM encrypted at rest. An attacker who copies `~/.orderfood/` to a different machine cannot decrypt the tokens, because the key is bound to the original machine ID. An attacker already on the same machine may be able to read the machine ID from system interfaces (e.g., `ioreg` on macOS) and derive the key — see "Compromised machine" below.
- **Accidental credential exposure** — tokens are never logged, never appear in error messages, and are not included in MCP tool responses.
- **Cross-machine token reuse** — the encryption key is derived from the local machine ID. Credentials copied to another machine cannot be decrypted.

### What this does NOT protect against

- **Local user access** — the machine ID is readable by any local user on macOS (`ioreg`) and Linux (`/etc/machine-id`). A local attacker (not just root) may be able to derive the encryption key and decrypt stored tokens. Use OS keychain integration (see [ROADMAP.md](ROADMAP.md)) if this is a concern.
- **Malicious process with server control** — the MCP server runs as a child process; whoever spawns it controls its stdin/stdout pipe and can invoke any tool, including `place_order`. There is no authentication on the stdio transport. Only run orderfood inside agents and environments you control.
- **Compromised npm supply chain** — this project's dependencies are not audited for supply chain attacks beyond standard npm provenance. Review `pnpm-lock.yaml` before use in high-security environments.
- **Platform session hijacking** — if a valid `jwt-session` / access token is stolen from memory or network, an attacker can use it directly against the platform APIs. This is a platform-level concern, not addressable here.
- **In-process token exposure** — decrypted tokens are held in the Node.js process heap during every tool call. A local attacker with access to process memory (debugger, crash dump) can extract plaintext tokens without touching `~/.orderfood/`. This is inherent to any in-process credential use and is not addressed by the on-disk encryption.

### Trust boundary

```
AI Agent (Claude / Codex)
    │  stdio
    ▼
MCP Server (orderfood)   ← trusts ALL connected clients
    │  HTTPS
    ▼
Platform APIs (Uber Eats, Thuisbezorgd)
```

The MCP server has no authentication of its own. It is designed for single-user local use. Do not expose it over a network socket or share it between users.

---

## Out of scope

- Vulnerabilities in the Uber Eats or Thuisbezorgd platforms themselves — please report those directly to the respective companies via their own responsible disclosure programs
- Use of this tool to automate requests at scale, credential sharing, or commercial automation — these are outside the intended use case and are not supported

---

## Supported versions

Only the latest commit on the `main` branch receives security fixes. There are no versioned release branches at this time.
