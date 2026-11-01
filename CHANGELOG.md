# Changelog

All notable changes to **CryptLink** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-11-01

### Added
- **Signal Protocol Engine:** Full implementation of Extended Triple Diffie-Hellman (X3DH) and Double Ratchet with symmetric KDF chains and asymmetric DH ratchets.
- **Out-of-Band SAS Verification:** 60-digit deterministic decimal Short Authentication String and 16×16 visual agreement matrix derived from SHA-512 public key intersection.
- **Sentinel C4ISR Tactical Radar & Defense HUD:** Real-time round-trip latency & jitter probes, polar radar sweep, anti-replay nonce ring cache, and DEFCON telemetry.
- **Zero-Knowledge Encrypted Vault:** Client-side PBKDF2 salt derivation, Argon2id master key derivation, and confidential note envelopes.
- **Synchronized Ephemeral Messaging:** 30s TTL disappearing timer triggered only upon recipient read-receipt / "seen" event, synchronizing memory and storage zeroization.
- **Mutual Verification Notifications:** Real-time WebSocket event dispatch informing contacts when their identity has been cryptographically pinned.
- **Zero-Touch MitM Defense:** Automated background key audit with instant transmission interlocks on identity key changes.
- **FIDO2 / WebAuthn:** Passwordless biometric passkey registration and authentication.
- **Comprehensive Test Suite:** 16 frontend Vitest tests and 14 backend Pytest attack simulation tests (30/30 passing).
