# Security Policy

## Security Warnings for Development & Hackathons

> [!CAUTION]
> **DO NOT USE MAINNET PRIVATE KEYS FOR TESTING OR DEPLOYMENT.**
> FreightX runs on the **Arc Testnet** and uses simulated token architectures. Never input any key that holds real-world funds.

## Reporting a Vulnerability

We take the security of FreightX seriously. If you find any security vulnerabilities in the smart contracts or application layer, please report them to us as soon as possible.

### How to Report

To report a vulnerability, please email the project maintainers or open a draft issue with a reproduction payload. Do not disclose the issue publicly until we have had an opportunity to address it.

Please include:
- A description of the vulnerability.
- Steps to reproduce (or a proof-of-concept script).
- Potential impact.

## Security Best Practices in FreightX

1. **Private Key Isolation:** The `.env` file containing the deployer private key is strictly excluded from Git tracking via `.gitignore`.
2. **Interactive Signers:** For Live Chain mode, we use standard MetaMask/RainbowKit providers. Sandbox private keys are generated dynamically and stored strictly in browser-level `localStorage`, never transmitted to external servers.
3. **Escrow Safeguards:** Escrows require multi-step verification. Milestones must be signed by registered IoT gateways or verified carriers before capital disbursements occur.
