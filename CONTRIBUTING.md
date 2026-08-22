# Contributing to VelocityCore

Thank you for your interest in contributing to **VelocityCore**! We welcome contributions that improve telemetry accuracy, expand Apple Silicon hardware benchmarks, refine the React/Tauri UI, or optimize the local diagnostic sidecar.

## Development Workflow

1. **Prerequisites**:
   - macOS 13.0+ (Apple Silicon M-series recommended)
   - Node.js 20+ and npm
   - Rust 1.75+ with `rustup target add aarch64-apple-darwin`
   - Python 3.11 for the sidecar
2. **Local Setup**:
   ```bash
   git clone https://github.com/PrachyatMisra/velocity-core.git
   cd velocity-core

   # Install desktop frontend dependencies
   npm install

   # Setup sidecar virtual environment
   npm run sidecar

   # Launch desktop dev mode
   npm run tauri:dev
   ```
3. **Web Companion Site**:
   To run the standalone web showcase locally:
   ```bash
   cd web
   npm install
   npm run dev
   ```
4. **Code Quality**:
   - Run type checks: `npm run lint` (in root) and `cd web && npm run lint`.
   - Ensure Rust builds cleanly: `cargo check --manifest-path src-tauri/Cargo.toml`.
5. **Pull Requests**:
   - Open PRs against the `main` branch with atomic commits and verification details.
