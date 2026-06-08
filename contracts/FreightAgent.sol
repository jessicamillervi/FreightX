// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IIdentityRegistry {
    function register(string calldata agentURI) external returns (uint256 agentId);
}

interface IReputationRegistry {
    function updateReputation(uint256 agentId, uint256 newScore) external;
}

interface IFreightEscrow {
    function pickupCargo(uint256 _shipmentId) external;
}

contract FreightAgent {
    // ERC-8004 agent identity
    address public agentWallet;
    string public agentName;
    uint256 public reputation;
    uint256 public agentId;

    address public constant IDENTITY_REGISTRY = 0x8004A818BFB912233c491871b3d84c89A494BD9e;
    address public constant REPUTATION_REGISTRY = 0x8004B663056A597Dffe9eCcC1965A193B7388713;

    address public escrowContract;
    address public owner;

    // ERC-8183 job management
    struct Job {
        uint256 id;
        uint256 shipmentId;
        string evidence;
        string status; // "Created", "Funded", "Submitted", "Completed", "Rejected"
        address client;
        address provider;
        address evaluator;
    }

    uint256 public nextJobId;
    mapping(uint256 => Job) public jobs;
    mapping(uint256 => uint256) public shipmentJobs; // shipmentId => jobId

    event AgentRegistered(uint256 indexed agentId, string agentName, address agentWallet);
    event JobCreated(uint256 indexed jobId, uint256 indexed shipmentId, string evidence, string status);
    event JobCompleted(uint256 indexed jobId, uint256 indexed shipmentId, string status);
    event ReputationUpdated(uint256 indexed agentId, uint256 newReputation);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyAgentOrOwner() {
        require(msg.sender == agentWallet || msg.sender == owner, "Only agent or owner");
        _;
    }

    constructor(
        string memory _agentName,
        address _agentWallet,
        address _escrowContract
    ) {
        owner = msg.sender;
        agentName = _agentName;
        agentWallet = _agentWallet;
        escrowContract = _escrowContract;
        reputation = 100; // default reputation score
    }

    // Call identity registry to register agent
    function registerAgent(string calldata agentURI) external onlyOwner returns (uint256) {
        // Try calling the IdentityRegistry
        try IIdentityRegistry(IDENTITY_REGISTRY).register(agentURI) returns (uint256 registeredId) {
            agentId = registeredId;
        } catch {
            // Fallback for simulation/local environments
            agentId = 42;
        }
        emit AgentRegistered(agentId, agentName, agentWallet);
        return agentId;
    }

    function updateAgentWallet(address _newWallet) external onlyOwner {
        agentWallet = _newWallet;
    }

    function updateEscrowContract(address _newEscrow) external onlyOwner {
        escrowContract = _newEscrow;
    }

    // ERC-8183 job management
    function createDisputeJob(uint256 shipmentId, string calldata evidence) external onlyAgentOrOwner {
        uint256 jobId = nextJobId++;
        jobs[jobId] = Job({
            id: jobId,
            shipmentId: shipmentId,
            evidence: evidence,
            status: "Funded",
            client: owner,
            provider: agentWallet,
            evaluator: owner
        });
        shipmentJobs[shipmentId] = jobId;

        // Penalty deduction on reputation
        if (reputation > 5) {
            reputation -= 5;
        } else {
            reputation = 0;
        }

        // Try updating Reputation Registry
        try IReputationRegistry(REPUTATION_REGISTRY).updateReputation(agentId, reputation) {} catch {}

        emit JobCreated(jobId, shipmentId, evidence, "Funded");
        emit ReputationUpdated(agentId, reputation);
    }

    function executeSettlement(uint256 shipmentId) external onlyAgentOrOwner {
        // Increase reputation upon successful settlement without disputes
        reputation += 10;
        try IReputationRegistry(REPUTATION_REGISTRY).updateReputation(agentId, reputation) {} catch {}

        // Resolve job if there was an open dispute job
        uint256 jobId = shipmentJobs[shipmentId];
        if (jobId < nextJobId && (shipmentJobs[shipmentId] != 0 || (jobId == 0 && nextJobId > 0 && jobs[0].shipmentId == shipmentId))) {
            jobs[jobId].status = "Completed";
            emit JobCompleted(jobId, shipmentId, "Completed");
        }

        // Call the escrow contract to trigger final delivery pickup
        IFreightEscrow(escrowContract).pickupCargo(shipmentId);
        
        emit ReputationUpdated(agentId, reputation);
    }
}
