# Security Policy

## Responsible Disclosure

VelocityCore interacts directly with macOS system APIs, SMC thermal sensors, and diagnostic endpoints. If you discover a security vulnerability or privilege escalation issue, please disclose it responsibly:

- Email: **prachyatmisra@gmail.com** (or via GitHub Security Advisories)

We will respond promptly and coordinate a patch release.

## Security Architecture & Sandboxing

- **Local-Only Diagnostic Sidecar**: The Python sidecar communicates strictly over `stdio` using JSON-RPC 2.0. No listening network sockets or external connections are spawned.
- **Tauri Permissions**: Tauri v2 capability manifests explicitly restrict plugin shell execution and notification scopes.
- **Non-Destructive Maintenance**: System cleaning utilities scan designated cache targets without modifying protected System Integrity Protection (SIP) volumes.
