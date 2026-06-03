# Contributing to FreightX

Thank you for your interest in contributing to FreightX! As an open-source logistics and trade finance orchestrator, we welcome and appreciate contributions of all kinds, from bug fixes and documentation improvements to new features and suggestions.

Please read through this guide to understand our development workflow and contribution guidelines.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please report any unacceptable behavior to the project maintainers.

## How Can I Contribute?

### 1. Reporting Bugs
- Search existing issues to see if the bug has already been reported.
- If not, create a new issue detailing:
  - Clear steps to reproduce the bug.
  - Expected behavior vs. actual behavior.
  - Screenshots or console logs if applicable.
  - Your environment details (OS, browser, Node.js version).

### 2. Suggesting Enhancements
- Open an issue explaining your proposed enhancement.
- Explain why this feature would be useful to FreightX users.
- Outline potential implementation details if you have any.

### 3. Pull Requests
We welcome pull requests! Follow these steps to submit your changes:
1. Fork the repository and create your branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Make your changes, keeping coding style consistent with the codebase.
4. Verify that the codebase builds and passes lint checks:
   ```bash
   npm run lint
   // Ensure it compiles without errors
   npm run build
   ```
5. Commit your changes using descriptive commit messages.
6. Push to your branch and open a Pull Request against our `main` branch.

## Coding Guidelines

- **TypeScript:** Use proper TypeScript typing. Avoid using `any` unless absolutely necessary.
- **Aesthetics & UI:** Keep the premium dark mode glassmorphic UI intact. Use the global CSS variables for styling instead of ad-hoc utilities.
- **Smart Contracts:** Ensure any modifications to Solidity contracts in the `contracts/` directory maintain standard compiler compatibility (Solidity `0.8.20`) and conform to gas-efficient coding guidelines.
- **Testing:** If you introduce new features, test them extensively in both Local Simulation Mode and Live Chain Mode on the Arc Testnet.

## Questions?

If you have any questions or need help getting started, please open a GitHub Issue or reach out to the team leaders.
