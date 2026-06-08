// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IFreightEscrow {
    function setDisputeActive(uint256 _shipmentId, bool _active) external;
    function resolveArbitration(uint256 _shipmentId, uint256 _supplierPayout, uint256 _carrierPayout) external;
    function owner() external view returns (address);
}

contract DisputeArbitration is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ARBITRATOR_ROLE = keccak256("ARBITRATOR_ROLE");

    address public usdcToken;
    address public escrowContract;
    uint256 public constant STAKE_AMOUNT = 100 * 1e6; // 100 USDC (6 decimals)

    struct Arbitrator {
        address addr;
        uint256 stakedAmount;
        uint256 reputation; // Initialized to 100, capped at 200, min 0
        bool registered;
    }

    struct Dispute {
        uint256 id;
        uint256 shipmentId;
        string evidenceHash; // IPFS hash containing document references and IoT telemetry
        uint256 proposedSupplierPayout; // Payout proposed by claimant
        uint256 proposedCarrierPayout;  // Payout proposed by claimant
        address claimant;
        uint256 voteCount;
        bool resolved;
        uint256 verdictSupplierPayout;
        uint256 verdictCarrierPayout;
    }

    struct Vote {
        uint256 supplierPayout;
        uint256 carrierPayout;
        bool voted;
    }

    uint256 public nextDisputeId;
    mapping(address => Arbitrator) public arbitrators;
    address[] public arbitratorAddresses;
    mapping(uint256 => Dispute) public disputes;
    
    // disputeId => arbitrator => Vote
    mapping(uint256 => mapping(address => Vote)) public votes;
    
    // disputeId => outcomeHash => voterCount (to track consensus)
    mapping(uint256 => mapping(bytes32 => uint256)) public consensusCount;
    // disputeId => outcomeHash => voters (to reward/penalize)
    mapping(uint256 => mapping(bytes32 => address[])) public consensusVoters;
    
    event ArbitratorRegistered(address indexed arbitrator, uint256 stakedAmount);
    event ArbitratorUnregistered(address indexed arbitrator, uint256 refundedAmount);
    event DisputeRaised(uint256 indexed disputeId, uint256 indexed shipmentId, address indexed claimant, string evidenceHash);
    event VoteSubmitted(uint256 indexed disputeId, address indexed arbitrator, uint256 supplierPayout, uint256 carrierPayout);
    event DisputeResolved(uint256 indexed disputeId, uint256 indexed shipmentId, uint256 supplierPayout, uint256 carrierPayout, bytes32 consensusHash);
    event ReputationUpdated(address indexed arbitrator, uint256 oldReputation, uint256 newReputation);

    constructor(address _usdcToken, address _escrow) {
        usdcToken = _usdcToken;
        escrowContract = _escrow;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
    }

    function setEscrowContract(address _escrow) external onlyRole(ADMIN_ROLE) {
        escrowContract = _escrow;
    }

    function registerArbitrator() external nonReentrant {
        require(!arbitrators[msg.sender].registered, "Already registered");
        require(
            IERC20(usdcToken).transferFrom(msg.sender, address(this), STAKE_AMOUNT),
            "Staking transfer failed"
        );

        arbitrators[msg.sender] = Arbitrator({
            addr: msg.sender,
            stakedAmount: STAKE_AMOUNT,
            reputation: 100,
            registered: true
        });

        _setupRole(ARBITRATOR_ROLE, msg.sender);
        arbitratorAddresses.push(msg.sender);

        emit ArbitratorRegistered(msg.sender, STAKE_AMOUNT);
    }

    function unregisterArbitrator() external nonReentrant {
        require(arbitrators[msg.sender].registered, "Not registered");
        uint256 stakeToRefund = arbitrators[msg.sender].stakedAmount;
        
        // Deduct penalty if reputation is too low
        if (arbitrators[msg.sender].reputation < 50) {
            uint256 penalty = (stakeToRefund * (50 - arbitrators[msg.sender].reputation)) / 100;
            stakeToRefund -= penalty;
            // Transfer penalty to escrow owner/governance
            if (penalty > 0) {
                address escrowOwner = IFreightEscrow(escrowContract).owner();
                IERC20(usdcToken).transfer(escrowOwner, penalty);
            }
        }

        delete arbitrators[msg.sender];
        revokeRole(ARBITRATOR_ROLE, msg.sender);

        // Remove from list
        for (uint256 i = 0; i < arbitratorAddresses.length; i++) {
            if (arbitratorAddresses[i] == msg.sender) {
                arbitratorAddresses[i] = arbitratorAddresses[arbitratorAddresses.length - 1];
                arbitratorAddresses.pop();
                break;
            }
        }

        require(
            IERC20(usdcToken).transfer(msg.sender, stakeToRefund),
            "Refund failed"
        );

        emit ArbitratorUnregistered(msg.sender, stakeToRefund);
    }

    function raiseDispute(
        uint256 _shipmentId,
        string calldata _evidenceHash,
        uint256 _proposedSupplierPayout,
        uint256 _proposedCarrierPayout
    ) external returns (uint256) {
        require(escrowContract != address(0), "Escrow contract not set");
        
        uint256 disputeId = nextDisputeId++;
        disputes[disputeId] = Dispute({
            id: disputeId,
            shipmentId: _shipmentId,
            evidenceHash: _evidenceHash,
            proposedSupplierPayout: _proposedSupplierPayout,
            proposedCarrierPayout: _proposedCarrierPayout,
            claimant: msg.sender,
            voteCount: 0,
            resolved: false,
            verdictSupplierPayout: 0,
            verdictCarrierPayout: 0
        });

        // Set dispute as active on the escrow contract to hold settlement
        IFreightEscrow(escrowContract).setDisputeActive(_shipmentId, true);

        emit DisputeRaised(disputeId, _shipmentId, msg.sender, _evidenceHash);
        return disputeId;
    }

    function vote(
        uint256 _disputeId,
        uint256 _supplierPayout,
        uint256 _carrierPayout
    ) external onlyRole(ARBITRATOR_ROLE) nonReentrant {
        Dispute storage d = disputes[_disputeId];
        require(!d.resolved, "Dispute already resolved");
        require(arbitrators[msg.sender].registered, "Arbitrator not registered");
        require(!votes[_disputeId][msg.sender].voted, "Already voted");

        votes[_disputeId][msg.sender] = Vote({
            supplierPayout: _supplierPayout,
            carrierPayout: _carrierPayout,
            voted: true
        });

        d.voteCount++;

        bytes32 outcomeHash = keccak256(abi.encodePacked(_supplierPayout, _carrierPayout));
        consensusCount[_disputeId][outcomeHash]++;
        consensusVoters[_disputeId][outcomeHash].push(msg.sender);

        emit VoteSubmitted(_disputeId, msg.sender, _supplierPayout, _carrierPayout);

        // Check if consensus reaches 3-of-5 voting threshold (3 votes for same outcome)
        if (consensusCount[_disputeId][outcomeHash] >= 3) {
            _resolveDispute(_disputeId, _supplierPayout, _carrierPayout, outcomeHash);
        }
    }

    function _resolveDispute(
        uint256 _disputeId,
        uint256 _supplierPayout,
        uint256 _carrierPayout,
        bytes32 _consensusHash
    ) internal {
        Dispute storage d = disputes[_disputeId];
        d.resolved = true;
        d.verdictSupplierPayout = _supplierPayout;
        d.verdictCarrierPayout = _carrierPayout;

        // Auto-execute custom settlement on the FreightEscrow contract
        IFreightEscrow(escrowContract).resolveArbitration(d.shipmentId, _supplierPayout, _carrierPayout);

        // Update arbitrator reputation based on consensus alignment
        address[] memory winningVoters = consensusVoters[_disputeId][_consensusHash];
        
        // Reward winning voters
        for (uint256 i = 0; i < winningVoters.length; i++) {
            address voter = winningVoters[i];
            uint256 oldRep = arbitrators[voter].reputation;
            if (oldRep < 200) {
                arbitrators[voter].reputation = oldRep + 10 > 200 ? 200 : oldRep + 10;
                emit ReputationUpdated(voter, oldRep, arbitrators[voter].reputation);
            }
        }

        // Penalize losing/dissenting voters who voted differently
        for (uint256 i = 0; i < arbitratorAddresses.length; i++) {
            address voter = arbitratorAddresses[i];
            if (votes[_disputeId][voter].voted) {
                bytes32 voterOutcomeHash = keccak256(abi.encodePacked(
                    votes[_disputeId][voter].supplierPayout,
                    votes[_disputeId][voter].carrierPayout
                ));
                if (voterOutcomeHash != _consensusHash) {
                    uint256 oldRep = arbitrators[voter].reputation;
                    arbitrators[voter].reputation = oldRep > 15 ? oldRep - 15 : 0;
                    emit ReputationUpdated(voter, oldRep, arbitrators[voter].reputation);
                }
            }
        }

        emit DisputeResolved(_disputeId, d.shipmentId, _supplierPayout, _carrierPayout, _consensusHash);
    }

    function getArbitratorCount() external view returns (uint256) {
        return arbitratorAddresses.length;
    }
}
