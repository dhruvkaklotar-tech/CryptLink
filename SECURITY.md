# Security Policy

## Threat Model & High-Assurance Guarantees

CryptLink is engineered under an adversarial threat model assuming:
1. **Hostile Network Transports:** All intermediate routing nodes, Wi-Fi access points, and TLS termination proxies are assumed to be compromised or actively surveilled.
2. **Zero-Trust Relays:** The messaging server operates as a blind relay. It possesses zero access to cryptographic master keys, prekeys, or message plaintexts.
3. **Compromised Infrastructure:** Even in the event of total server database compromise or rogue administrative access, past and future messages remain mathematically unrecoverable due to **Perfect Forward Secrecy (PFS)** and **Self-Healing Break-in Recovery**.

---

## Supported Versions

Only the latest release of CryptLink receives active security patches.

| Version | Supported          | Cryptographic Primitives |
| :------ | :----------------- | :----------------------- |
| 1.0.x   | :white_check_mark: | AES-256-GCM, Curve25519, Ed25519, HKDF-SHA256, Argon2id |
| < 1.0   | :x:                | Deprecated |

---

## Reporting a Vulnerability

We prioritize responsible disclosure of security vulnerabilities, cryptographic implementation flaws, and protocol design defects.

If you discover a vulnerability in CryptLink:
1. **Do not create a public GitHub issue.** Public issues disclose unpatched attack vectors before mitigations can be deployed.
2. Email the maintainers directly at: **security@cryptlink.internal** or submit a private security advisory via GitHub Advisory Database.
3. Please include:
   - A detailed technical description of the vulnerability.
   - Proof-of-concept (PoC) code or step-by-step reproduction instructions.
   - Potential impact and threat vector evaluation.

### Response Timelines
- **Initial Response & Confirmation:** Within 24 hours.
- **Triage & Reproducibility Analysis:** Within 48 hours.
- **Mitigation & Coordinated Patch Release:** Within 7 days (or sooner for critical-rated exploits).

---

## Cryptographic Invariants

Any contribution or modification to this repository must preserve the following non-negotiable invariants:
- **Zero Dummy Data:** No fallback mocks, hardcoded test strings, or placeholder cryptographic credentials in production code paths.
- **Client-Side Key Generation:** Private keys never leave the browser client's volatile memory or encrypted IndexedDB instance.
- **Mandatory Nonce Uniqueness:** AES-256-GCM nonces must remain strictly monotonic or cryptographically unique per key. Duplicate nonces trigger instant connection drop.
- **Interlocked Key Pinning:** Any change in a contact's public identity key without out-of-band re-verification immediately halts message dispatch.
