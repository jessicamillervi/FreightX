# FreightX — Logistics & Trade Finance Orchestrator

> An end-to-end stablecoin-powered logistics escrow, invoice factoring, and pre-shipment financing platform built on [Arc Network](https://docs.arc.network/) using [Circle's USDC](https://developers.circle.com/stablecoins/what-is-usdc).

![Arc Network](https://img.shields.io/badge/Arc_Testnet-L1_Blockchain-0088ff?style=for-the-badge)
![USDC](https://img.shields.io/badge/USDC-Settlement_Rail-2775CA?style=for-the-badge)
![EURC](https://img.shields.io/badge/EURC-Multi_Currency-00e676?style=for-the-badge)
![Next.js 15](https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge)
![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?style=for-the-badge)

---

## 🎯 Problem Statement

International shipping and cross-border trade settlement is throttled by:

- 📑 **Manual Bill-of-Lading Workflows:** Reconciliation across shippers, ports, customs, and carriers takes weeks, relying on physical, forgeable paper slips.
- 💸 **Working Capital Deadlock:** SME suppliers lock up $30K–$500K for 30–90 days waiting for sluggish bank Letters of Credit (L/C) processing.
- 🧊 **Cold-Chain Vulnerability:** High-value perishables (frozen food, pharmaceuticals) go bad during transit without automated compliance tracking, leading to legal disputes.
- ⏳ **Demurrage Extortion:** Late cargo pickup triggers astronomical port storage penalties that are manual, delayed, and easy to manipulate.
- 🏦 **Expensive Intermediaries:** Traditional bank letters of credit cost 1.5%–3% of total cargo value and take 5–15 business days to clear.

---

## 💡 The FreightX Solution

FreightX replaces legacy trade finance infrastructure with **programmable stablecoin escrows on Arc L1**, enabling sub-second finality and native gas simplicity:

- 🤝 **Smart Contract Escrows:** Buyer funds are locked on-chain in USDC or EURC, auto-released securely as milestones are cleared.
- ⚡ **Singapore Port Checkpoint Milestone:** Automatically disburse 30% of locked supplier capital as soon as cargo passes the Singapore Transshipment Hub, boosting working capital mid-transit.
- 📊 **Pre-Shipment PO Financing:** Suppliers auction purchase orders to investors for up to 80% advance financing at a fixed 5% interest, with settlement automated via incoming buyer escrow deposits.
- 📈 **Invoice Factoring Hub:** Shippers sell pending cargo receivables at a minor discount to unlock immediate operating liquidity. Payout beneficiaries are transparently redirected on-chain.
- 🌡️ **IoT Climate Oracle & Automatic Penalties:** Real-time container telemetry feeds directly to contracts. Breach of safe cold-chain thresholds (>8.0°C) triggers instant 5% supplier payouts cuts.
- ⏱️ **Time-Accelerated Demurrage Timers:** Timers start immediately upon Customs Clearance. Storage penalties are automatically computed and subtracted from the carrier payout on container pickup.
- 🎟️ **Cargo Digital Twin Passport:** Every shipment mints an ERC-721 NFT passport logging immutable on-chain history (location, transit status, temperature logs, and cryptographic validator signatures).

---

## 🏗 System Architecture & Smart Contract Flow

FreightX uses a robust client-blockchain model built with Next.js 15, Viem, and custom Solidity contracts deployed to Arc Network.

### Component Map
```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            FreightX Platform (Frontend)                      │
├──────────────────────────┬───────────────────────────────────────────────────┤
│    Next.js 15 App        │     Solidity Smart Contracts (Arc Testnet)        │
│                          │                                                   │
│   ┌───────────────┐      │     ┌──────────────────┐    ┌──────────────────┐  │
│   │ Escrow Manager│──────┼────►│ FreightEscrow.sol│◄──►│FreightPassport.sol│ │
│   │ IoT Simulator │      │     │  • USDC/EURC Lock│    │  • ERC-721 NFT   │  │
│   │ PO Financing  │      │     │  • Milestones    │    │  • Cargo History │  │
│   │ Credit Passport│     │     │  • Demurrage Calc│    │  • Temp Telemetry│  │
│   │ Crew Payroll  │      │     │  • PO Waterfall  │    │  • Status Updates│  │
│   │ StableFX Calc │      │     │  • Invoice Factor│    │                  │  │
│   └───────────────┘      │     └──────────────────┘    └──────────────────┘  │
├──────────────────────────┴───────────────────────────────────────────────────┤
│                           Arc Network L1 Blockchain                          │
│        USDC Native Gas   •   Sub-Second Finality   •   USDC/EURC ERC-20      │
└──────────────────────────────────────────────────────────────────────────────┘
```

### End-to-End Workflow Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Supplier as SME Supplier
    actor Buyer as Global Buyer
    actor Investor as Funder / Investor
    actor IoT as IoT Cargo Sensor
    participant Escrow as FreightEscrow Contract
    participant Passport as FreightPassport NFT

    Note over Supplier, Investor: 1. Pre-Shipment PO Financing Setup
    Supplier->>Escrow: Request PO financing (80% of $1,000 Cargo)
    Investor->>Escrow: Fund PO Loan ($800 in USDC)
    Escrow->>Supplier: Disburse $800 working capital immediately

    Note over Buyer, Escrow: 2. Core Trade Escrow Locking & PO Waterfall
    Buyer->>Escrow: Create Shipment Escrow ($1,000 + $100 Shipping)
    Note over Escrow: Escrow detects linked PO loan!
    Escrow->>Investor: Auto-repay $840 ($800 principal + 5% flat interest)
    Escrow->>Passport: Mint digital twin Cargo NFT
    
    Note over IoT, Passport: 3. IoT Oracle Telematics Verification
    IoT->>Escrow: Update milestone: Cargo Departure (Temp: 4.2°C)
    IoT->>Escrow: Singapore Port reached (Temp: -18.2°C)
    Escrow->>Supplier: Release 30% early payout ($300 USDC)
    
    Note over IoT, Escrow: 4. Temp Breaches & Customs
    IoT->>Escrow: Breach alert! Temperature = 12.5°C (>8.0°C threshold)
    Note over Escrow: Log 1x Temp breach (5% penalty applied)
    IoT->>Escrow: Destination Port Arrived & Customs Cleared
    Note over Escrow: Demurrage timer starts (Free window: 2 hours)
    
    Note over Buyer, Supplier: 5. Container Pickup, Penalties & Payroll
    Buyer->>Escrow: Pickup cargo (Simulated 4 hours late)
    Note over Escrow: Calculate demurrage ($15/hr * 2 hours over = $30)
    Escrow->>Supplier: Release final Net payout ($700 - Temp Penalty)
    Escrow->>Escrow: Sweeps USYC simulated 5% yield to Buyer
    Supplier->>Escrow: Split carrier payroll to Crew Wallets (Split Command)
    Escrow-->>Supplier: Net payout successfully finalized!
```

---

## 🔄 Core Tab Workflows (Detailed Mermaid Flowcharts)

To make it easy to audit the business logic, state transitions, and smart contract methods behind the dashboard interfaces, each of the 6 core tabs is mapped to its exact workflow below:

### 1. 🌐 Gateway Hub (Onchain Sandbox)
Manages localized key generation, Web3 provider handshakes, RPC querying, and contract compilations/deployments client-side to ensure the sandbox is fully operable:

```mermaid
graph TD
    A[Start: Gateway Hub Tab] --> B{Choose Wallet Mode}
    B -->|Sandbox Mode| C[Generate Local ECDSA Private Key]
    C --> D[Store privateKey in browser LocalStorage]
    B -->|Live Web3 Mode| E[Connect MetaMask / RainbowKit Wallet]
    D --> F[Viem Client Hook: Query RPC Balances]
    E --> F
    F --> G[Read USDC native gas + USDC/EURC balances]
    G --> H{Balances Sufficient?}
    H -->|No| I[Link to Circle Arc Faucet & Funder Tool]
    I --> F
    H -->|Yes| J[Action: Deploy Smart Contracts Suite]
    J --> K[Step 1: Deploy FreightPassport NFT Contract]
    K --> L[Step 2: Deploy FreightEscrow Settlement Contract]
    L --> M[Step 3: Deploy MockUSYC Treasury Yield Vault]
    M --> N[Step 4: Link contracts setEscrowContract + setPassportContract]
    N --> O[Registry Complete: Save to LocalStorage]
```

### 2. 🤝 Escrow Shipments (Cargo Registry)
Handles buyer-supplier cargo escrows, token allowance checks, Purchase Order linking, and digital-twin cargo NFT creation:

```mermaid
sequenceDiagram
    autonumber
    actor Buyer as Global Buyer
    participant UI as Cargo Registry Dashboard
    participant ERC20 as USDC/EURC Contract
    participant Escrow as FreightEscrow Contract
    participant Passport as FreightPassport NFT

    Buyer->>UI: Input details (Supplier, Carrier, Cargo & Shipping Value, linked PO ID)
    UI->>ERC20: Query Allowance for (Cargo Value + Shipping Fee)
    alt Allowance too low
        UI->>ERC20: Write approve(escrowAddress, amountNeeded)
        ERC20-->>Buyer: Signature required: Confirm allowance
    end
    UI->>Escrow: Write createShipment(...)
    Note over Escrow: Check if PO ID is linked to active PO Loan
    critical PO Repayment Waterfall
        Escrow->>ERC20: Transfer PO Loan repayment (Principal + 5% flat fee) to Investor
        Note over Escrow: Active PO loan status changes to repaid = true!
    end
    Escrow->>ERC20: Lock remaining buyer cargo value + carrier fee
    Escrow->>Passport: Call safeMint(...)
    Passport-->>Escrow: Return Passport NFT Token ID
    Escrow-->>UI: Escrow logged & created (mints Digital Cargo Twin)
    UI-->>Buyer: Booking secured and active!
```

### 3. 🌡️ IoT Tracking (Climate Telemetry & Milestones)
Monitors physical transit checkpoints, implements cold-chain temperature thresholds, and triggers early milestone payouts or compliance cuts:

```mermaid
sequenceDiagram
    autonumber
    actor Simulator as IoT Telematics Simulator
    participant Escrow as FreightEscrow Contract
    participant Passport as FreightPassport NFT
    actor Supplier as SME Supplier

    Note over Simulator, Escrow: Milestone 1: Confirm Cargo Departure
    Simulator->>Escrow: write triggerMilestoneDeparture(ShipmentId, Temp: 4.2°C)
    Escrow->>Passport: updateMetadata("In Transit", "Departure Port", tempScaled)
    
    Note over Simulator, Escrow: Milestone 2: Singapore Hub (Early Payout)
    Simulator->>Escrow: write triggerMilestoneSingapore(ShipmentId, Temp: -18.2°C)
    Escrow->>Passport: updateMetadata("In Transit", "Singapore Hub", tempScaled)
    Escrow->>Supplier: Auto-disburse 30% cargo value from Escrow principal to Supplier
    
    Note over Simulator, Escrow: Cold-Chain Breakdown Audit
    Simulator->>Escrow: write triggerCustomClearance(ShipmentId, Temp: 12.5°C)
    Note over Escrow: Temp exceeds 8.0°C! Increment temperatureViolations & log penalty
    Escrow->>Passport: updateMetadata("Customs Cleared", "Destination Hub", tempScaled)
```

### 4. 💸 Instant Payroll (Mass Carrier Split-Pay)
Carrier dispatchers programmatically split their net logistics payouts among ground drivers, harbor authorities, toll agencies, and subcontractors:

```mermaid
graph TD
    A[Cargo Pickup Confirmed] --> B[Calculate Carrier Net Shipping Fee]
    B --> C[Open Subcontractor Split-Pay UI]
    C --> D[Define multiple wallets & payroll values]
    D --> E{Sum of splits <= Carrier Payout?}
    E -->|No| F[Display validation warning & disable button]
    E -->|Yes| G[Request carrier signature]
    G --> H[Write payoutCrew on FreightEscrow contract]
    H --> I[EVM dispatches USDC/EURC mass payouts in a single transaction]
    I --> J[Fuel merchant wallet credited]
    I --> K[Harbor harbor fee wallet credited]
    I --> L[Ground truck driver wallet credited]
```

### 5. 🪪 Reputation Passports (Enterprise Trust)
Processes historical trade performance and telemetry data to generate digital grade passports and export cryptographic credentials:

```mermaid
graph TD
    A[Onchain Cargo Passport NFT History] --> B[Read count of Completed Escrows]
    A --> C[Audit telematics temp compliance rates]
    A --> D[Audit PO repayment speed logs]
    B --> E[Compute Reputation Score: 0-100]
    C --> E
    D --> E
    E --> F{Evaluate Credit Rating Grade}
    F -->|Score >= 95| G["AAA Rating"]
    F -->|85 to 95| H["AA Rating"]
    F -->|70 to 85| I["A Rating"]
    F -->|Score under 70| J["BBB/B Rating"]
    G --> K[Save dynamic grade in FreightPassport NFT metadata]
    H --> K
    I --> K
    J --> K
    K --> L[Action: Generate W3C Verifiable Credential]
    L --> M[Apply FreightX DID signature using local/signer keys]
    M --> N[Download signed JSON-LD Credential]
```

### 6. 📈 Capital Marketplace (Receivables Factoring & POs)
Suppliers list pending cargo invoices for auction and request purchase order working capital to finance production:

```mermaid
sequenceDiagram
    autonumber
    actor Supplier as SME Supplier
    actor Investor as Investor / Funder
    participant Escrow as FreightEscrow Contract
    actor Buyer as Global Buyer

    Note over Supplier, Escrow: 1. PO Financing Setup (Pre-Shipment)
    Supplier->>Escrow: Submit request for pre-shipment PO loan (80% of Cargo)
    Investor->>Escrow: Fund PO Loan (Lock USDC/EURC principal)
    Escrow->>Supplier: Disburse working capital instantly (interest: 5% flat)
    
    Note over Supplier, Investor: 2. Invoice Factoring Hub (Mid-Transit)
    Supplier->>Escrow: Offer pending shipment receivable at discounted price
    Investor->>Escrow: Purchase receivable invoice claims
    Escrow->>Supplier: Disburse discounted stablecoins instantly
    Note over Escrow: Contract changes beneficiary from Supplier to Investor!
    
    Note over Buyer, Investor: 3. Final Escrow Settle
    Buyer->>Escrow: Accept cargo & trigger final settlement
    Escrow->>Investor: Route net settlement payout directly to Investor (Waterfall Closed)
```

---

## 🔗 Live Deployed Contracts on Arc Testnet

FreightX is fully deployed and verified on the **Arc Testnet L1 Network**:

- 📜 **FreightEscrow Core:** [`0xe6a4be867a1e798508a744ff115a95890afbbd45`](https://testnet.arcscan.app/address/0xe6a4be867a1e798508a744ff115a95890afbbd45)
- 🎟️ **FreightPassport (ERC-721):** [`0xa106b3548e8d7bed77d984c1d6f9d60798bb87b0`](https://testnet.arcscan.app/address/0xa106b3548e8d7bed77d984c1d6f9d60798bb87b0)
- 💵 **USDC (Native Arc Gas Token):** [`0x3600000000000000000000000000000000000000`](https://testnet.arcscan.app/token/0x3600000000000000000000000000000000000000)
- 💶 **EURC (Multi-currency ERC-20):** [`0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`](https://testnet.arcscan.app/token/0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a)

---

## ✨ Key Features Breakdown

### 🏢 B2B Trade & Finance Workflow
- **Multi-Asset Support:** Escrows can be settled in either standard **USDC** or **EURC** to accommodate both transatlantic and transpacific SME trading routes.
- **Milestone Payout Waterfall:** Avoid locking liquidity point-to-point. A configurable 30% of locked funds is automatically routed to the supplier upon passing mid-transit hub checkpoints.
- **USYC Treasury Account Sweep:** Escrowed principal is deposited directly into a simulated 5% APY Treasury Account (USYC) for the duration of shipping. Accumulated yield is credited as a rebate back to the buyer upon final delivery.

### ⏱️ Demurrage Acceleration Engine
- Configurable free hours discharge window and progressive penalty pricing.
- Interactive time-speed simulation dials up time elapsed, providing realistic penalties on container retrieval.
- Auto-reconciliation of storage penalties paid by the carrier before final cargo release is permitted.

### 📈 Invoice Factoring Hub & PO financing
- **SME Capital Pre-Funding:** Suppliers request PO loans. External funders deploy USDC/EURC, capturing a stable, guaranteed 5% flat return.
- **Invoice Factoring:** Suppliers list pending trade invoices on an open claims directory. Investors acquire invoice claims at a minor discount, redirecting the final payout to the investor's wallet.

### 🎓 SME Credit Passport (W3C Verifiable Credentials)
- Analyzes on-chain metadata including completed contracts count, reputation compliance score, and PO repayment speed to calculate an enterprise grade (AAA, AA, A, BBB, B).
- **1-Click VC Export:** Generates W3C-compliant cryptographic Verifiable Credentials (signed JSON-LD format) for suppliers, carriers, and buyers to prove reputation off-chain.

---

## 🛠 Circle Commerce Stack & Arc Integrations

| Technology | Implementation | Impact |
|------------|----------------|--------|
| **Circle USDC** | Deployed as the primary gas and payment asset on Arc. | Guarantees stable-value escrows, eliminates gas volatility, and achieves transaction completion in <1 second. |
| **Circle EURC** | Active alternative token settlement system. | Enables seamless multi-currency support for Euro corridor shipping routes without FX exposure. |
| **StableFX Bridge** | Integrated AED currency rate calculator. | Translates Middle Eastern regional cargo value demands directly into digital USD equivalent values instantly. |
| **USYC Integration** | Sweep deposits into automated yield account. | Captures dynamic treasury returns during active shipping timeframes, adding a 5% APY yield utility to idle cargo capital. |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18.0 or higher
- npm or yarn

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd FreightX
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run local developer server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the FreightX console dashboard.

---

## 🧪 Comprehensive End-to-End Walkthrough

You can test the entire workflow in **Local Simulation Mode** (no wallet or gas required) or **Live Chain Mode** (Arc Testnet):

### Phase 1: Pre-Shipment PO Financing
1. Go to the **Capital Marketplace** tab.
2. Under "Apply for Pre-Shipment Capital", enter a Buyer Address, target Cargo Value, and Loan Amount. Click **Submit Request**.
3. In the "Active PO Loans Board" table, click **Fund PO Loan** to simulate an investor providing liquidity.
4. The status updates to **Capital Disbursed**. The supplier has unlocked operational liquidity!

### Phase 2: Booking the Cargo Escrow
1. Go to the **Cargo Registry** (or Escrow Shipments tab).
2. Click **Book New Container Escrow**.
3. Check the **Link to Active PO Loan** box, and select the PO Loan ID you created in Phase 1.
4. Input route parameters (e.g., Singapore Port, Shenzhen, LA Port) and click **Create Secured Escrow**.
5. *Waterfall Check:* The smart contract automatically locks the buyer's deposit and instantly routes the principal + 5% interest payment back to the Funder's wallet, closing the PO loan cycle!

### Phase 3: Telematics Tracking & IoT Milestones
1. Select your cargo in the **Cargo Registry** and click **Track Shipments** to load the IoT telemetry dashboard.
2. Under "Milestone Checkpoints", click **Confirm Departure** to start cargo transit.
3. Next, click **Arrived at Singapore Hub**. *Milestone Check:* 30% of the supplier cargo funds are released instantly mid-journey to support carrier fuel/toll cash flow.
4. Adjust the **Temperature Controller Slider** above 8.0°C to simulate a cold-chain breakdown. The sensor warns you of a breach and automatically docks a penalty from the final supplier payout.

### Phase 4: Customs, Demurrage, and Split Payroll
1. Click **Confirm Arrival** and then **Confirm Customs Clearance**.
2. *Demurrage Clock:* Since customs is cleared, container pickup has a free time window (e.g., 2 hours).
3. Use the **Time Accelerator dial** to speed up simulated hours.
4. Click **Accept Container & Trigger Final Settlement**. Any demurrage penalties are calculated and adjusted automatically.
5. In the **Subcontractor Split Payroll** card, click **Disburse Multi-Party Split Pay** to split the carrier's fee instantly among truck drivers, harbor tolls, and fuel suppliers.

---

## 📄 W3C Verifiable Credential Example

Upon successful delivery, suppliers, buyers, and carriers can export verified credit score credentials. Below is a sample payload exported by the dashboard:

```json
{
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://schema.org"
  ],
  "id": "urn:uuid:f5b128c9-de3a-4b08-8e6d-6254a6bc7a89",
  "type": ["VerifiableCredential", "TradeReputationCredential"],
  "issuer": "did:web:freightx.network",
  "issuanceDate": "2026-05-25T09:30:00Z",
  "credentialSubject": {
    "id": "did:ethr:0x8d92F677cD6303Cec089B5F319D72aA797da53",
    "legalName": "SME Logistics Ltd",
    "role": "Supplier",
    "reputationScore": 98,
    "creditRatingGrade": "AAA",
    "totalVolumeSettled": "285,000 USDC",
    "completedContractsCount": 32,
    "telematicsCompliance": "99.2%",
    "poRepaymentRate": "100%"
  },
  "proof": {
    "type": "JsonWebSignature2020",
    "created": "2026-05-25T09:31:00Z",
    "proofPurpose": "assertionMethod",
    "verificationMethod": "did:web:freightx.network#key-1",
    "jws": "eyJhbGciOiJSUzI1NiIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19...xyz"
  }
}
```

---

## 💬 Circle Product & Arc Developer Feedback

### 🌟 What Worked Well
1. **Deterministic Gas System:** Arc's dollar-denominated USDC-as-gas fees made platform integrations incredibly easy. We could precisely calculate transaction costs for global SMEs without fluctuating gas spikes.
2. **Sub-second Finality:** The speed of the Arc L1 network is transformative for logistics. Milestone payouts (like Singapore Hub clearance) confirm instantly on-chain, matching real-world freight processing speed.
3. **EVM Compatibility:** Deployed standard Solidity contracts without changing code. Standard tools like `viem` and `wagmi` worked seamlessly with Arc endpoints.

### 💡 Suggested Improvements
1. **EURC Faucet Simplification:** While the USDC faucet worked flawlessly, accessing testnet EURC required multiple manual steps. A unified testnet faucet dispensing all Circle assets would streamline multi-currency tests.
2. **StableFX API Access:** Enterprise gates limited live FX integrations. Opening a public sandbox StableFX API with mock rates would let hackathon developers build real-time FX-aware escrow systems.
3. **Automated Verification:** Support for automatic programmatic contract verification via standard API tooling on ArcScan explorer would enhance contract deployment pipelines.

---

## 📜 License

MIT License. Designed and built for the **Agora Hackathon — USDC Commerce Stack Challenge**.
