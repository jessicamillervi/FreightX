// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// OpenZeppelin imports removed to reduce contract size under the 24,576 byte EVM limit

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IFreightPassport {
    function mint(address to, string calldata departure, string calldata destination) external returns (uint256);
    function updatePassport(uint256 tokenId, string calldata status, string calldata location, int256 temperature, bool completed) external;
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface IMockUSYC {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
    function getExchangeRate() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}

interface IMessageTransmitter {
    function usedNonces(bytes32 sourceAndNonce) external view returns (uint256);
}

contract FreightEscrow {
    // Custom lightweight Roles, Pausable, and ReentrancyGuard implementation
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    mapping(bytes32 => mapping(address => bool)) private _roles;
    bool public paused;
    uint8 private _reentrancyStatus = 1; // 1 = unlocked, 2 = locked

    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _roles[role][account];
    }

    function grantRole(bytes32 role, address account) public onlyAdmin {
        _roles[role][account] = true;
    }

    function revokeRole(bytes32 role, address account) public onlyAdmin {
        _roles[role][account] = false;
    }

    function _setupRole(bytes32 role, address account) internal {
        _roles[role][account] = true;
    }

    modifier onlyAdmin() {
        require(_roles[ADMIN_ROLE][msg.sender]);
        _;
    }

    modifier onlyOracle() {
        require(_roles[ORACLE_ROLE][msg.sender] || msg.sender == oracleContract);
        _;
    }

    modifier onlyOperator() {
        require(_roles[OPERATOR_ROLE][msg.sender]);
        _;
    }

    modifier whenNotPaused() {
        require(!paused);
        _;
    }

    modifier nonReentrant() {
        require(_reentrancyStatus == 1);
        _reentrancyStatus = 2;
        _;
        _reentrancyStatus = 1;
    }


    address public owner; // Maintained for backward compatibility and tracking
    address public usdcToken;
    address public eurcToken;
    address public passportContract;

    enum ShipmentStatus { Created, InTransit, Arrived, CustomCleared, Completed, Cancelled }

    struct Shipment {
        uint256 id;
        address buyer;
        address supplier;
        address carrier;
        uint256 cargoValue; // 6 decimals (USDC/EURC)
        uint256 shippingFee; // 6 decimals (USDC/EURC)
        uint256 releasedSupplierAmount; // 6 decimals
        uint256 releasedCarrierAmount; // 6 decimals
        string departurePort;
        string destinationPort;
        ShipmentStatus status;
        uint256 arrivedTimestamp;
        uint256 customClearanceTimestamp;
        uint256 pickupTimestamp;
        uint256 freeTimeHours;
        uint256 demurrageRatePerHour; // 6 decimals
        uint256 demurragePenaltyPaid; // 6 decimals
        uint256 passportTokenId;
        address token; // USDC or EURC
        bool exists;
    }

    uint256 public nextShipmentId;
    mapping(uint256 => Shipment) public shipments;
    mapping(address => uint256[]) private _buyerShipments;
    mapping(address => uint256[]) private _supplierShipments;
    mapping(address => uint256[]) private _carrierShipments;

    // Advanced Features: Invoice Factoring, USYC Yield, and IoT Temperature Compliance
    struct FactoringOffer {
        uint256 price; // 6 decimals
        bool active;
        address investor;
    }
    
    uint256 public constant USYC_APY_BPS = 500; // 5% simulated APY
    int256 public constant MAX_TEMPERATURE_LIMIT = 800; // 8.0°C limit for cold-chain
    uint256 public constant MIN_ESCROW_VALUE = 1e6; // Enforce minimum escrow value of 1 token (e.g. 1 USDC)
    uint256 public constant MAX_PO_LOAN_CAP = 1_000_000 * 1e6; // Max purchase order loan cap (1M tokens)

    mapping(uint256 => FactoringOffer) public factoringOffers;
    mapping(uint256 => address) public shipmentBeneficiary; // redirects supplier payout to investor if factored
    mapping(uint256 => uint256) public temperatureViolations;
    mapping(uint256 => uint256) public createdTimestamps;
    mapping(uint256 => uint256) public yieldEarned;
    mapping(uint256 => uint256) public temperaturePenalties; // recorded penalty on completion
    mapping(uint256 => bool) public singaporeMilestonePaid;

    // IoT Cryptographic Device Gateway Verification
    mapping(uint256 => address) public iotGateway; // shipmentId => registered IoT device address
    mapping(uint256 => uint256) public humidityData; // shipmentId => last humidity reading (x100)

    // USYC Yield-Bearing Escrow Vault
    address public usycVault; // address of MockUSYC ERC-4626 vault
    mapping(uint256 => uint256) public usycShares; // shipmentId => shares held in vault
    mapping(uint256 => bool) public usycWrapped; // whether escrow funds are wrapped in USYC

    // CCTP Cross-Chain Bridge Receiver
    mapping(uint256 => bytes32) public cctpSourceTxHash; // shipmentId => source chain burn tx hash
    mapping(uint256 => uint32) public cctpSourceDomain; // shipmentId => source chain domain
    mapping(bytes32 => bool) public processedCCTPNonces; // prevent double-spend of CCTP messages
    mapping(uint256 => bool) public cctpFundingRequired; // track if a shipment expects CCTP funding

    // Arc Testnet CCTP Addresses
    address public constant TOKEN_MESSENGER = 0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA;
    address public constant MESSAGE_TRANSMITTER = 0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275;

    // Dedicated Oracle Contract
    address public oracleContract;

    // Multi-Sig Dispute Arbitration
    address public arbitrationContract;
    mapping(uint256 => bool) public disputeActive;

    // Purchase Order (PO) Financing
    struct POLoan {
        uint256 id;
        address supplier;
        address buyer;
        uint256 cargoValue;
        uint256 loanRequested;
        uint256 repaymentAmount;
        address investor;
        bool funded;
        bool repaid;
        address token;
    }

    uint256 public nextPOId;
    mapping(uint256 => POLoan) public poLoans;
    mapping(uint256 => uint256) public shipmentPOLoans; // shipmentId => poId
    mapping(uint256 => bool) public shipmentHasPOLoan;

    event ShipmentCreated(uint256 indexed shipmentId, address indexed buyer, address indexed supplier, address carrier, uint256 passportId, address token);
    event MilestoneReached(uint256 indexed shipmentId, string milestoneName, string location, int256 temperature, uint256 payoutAmount);
    event DemurrageCharged(uint256 indexed shipmentId, uint256 hoursLate, uint256 penaltyAmount);
    event ShipmentCompleted(uint256 indexed shipmentId, uint256 supplierPayout, uint256 carrierPayout, uint256 platformFee);
    event ShipmentCancelled(uint256 indexed shipmentId);
    event CarrierPayrollPaid(uint256 indexed shipmentId, address indexed carrier, uint256 totalAmount, uint256 crewCount);

    // Advanced Feature Events
    event FactoringOffered(uint256 indexed shipmentId, address indexed supplier, uint256 price);
    event FactoringCancelled(uint256 indexed shipmentId, address indexed supplier);
    event FactoringPurchased(uint256 indexed shipmentId, address indexed supplier, address indexed investor, uint256 price);
    event TemperatureViolationLogged(uint256 indexed shipmentId, string location, int256 temperature, uint256 totalViolations);

    // PO Financing Events
    event POFinancingRequested(uint256 indexed poId, address indexed supplier, address indexed buyer, uint256 cargoValue, uint256 loanRequested, address token);
    event POFinancingFunded(uint256 indexed poId, address indexed investor, uint256 loanAmount);
    event POFinancingRepaid(uint256 indexed poId, address indexed investor, uint256 repaymentAmount);

    // IoT Signature Verification Events
    event IoTGatewayRegistered(uint256 indexed shipmentId, address indexed gateway);
    event IoTSignatureVerified(uint256 indexed shipmentId, address indexed signer, string milestoneType, int256 temperature, uint256 humidity);

    // USYC Yield Vault Events
    event EscrowWrappedInUSYC(uint256 indexed shipmentId, uint256 assets, uint256 shares);
    event EscrowRedeemedFromUSYC(uint256 indexed shipmentId, uint256 shares, uint256 assetsReturned, uint256 yieldGenerated);

    // CCTP Cross-Chain Events
    event CCTPFundingReceived(uint256 indexed shipmentId, uint32 sourceDomain, bytes32 sourceTxHash, uint256 amount);

    modifier holdSettlement(uint256 _shipmentId) {
        require(!disputeActive[_shipmentId]);
        _;
    }

    constructor(address _usdcToken, address _eurcToken) {
        owner = msg.sender;
        usdcToken = _usdcToken;
        eurcToken = _eurcToken;

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        _setupRole(ORACLE_ROLE, msg.sender);
        _setupRole(OPERATOR_ROLE, msg.sender);
    }

    function setPassportContract(address _passport) external onlyAdmin whenNotPaused {
        passportContract = _passport;
    }

    function setUsycVault(address _vault) external onlyAdmin whenNotPaused {
        usycVault = _vault;
    }

    function setOracleContract(address _oracle) external onlyAdmin whenNotPaused {
        if (oracleContract != address(0)) {
            revokeRole(ORACLE_ROLE, oracleContract);
        }
        oracleContract = _oracle;
        if (_oracle != address(0)) {
            grantRole(ORACLE_ROLE, _oracle);
        }
    }

    function setArbitrationContract(address _arbitration) external onlyAdmin whenNotPaused {
        arbitrationContract = _arbitration;
    }

    function setDisputeActive(uint256 _shipmentId, bool _active) external {
        require(msg.sender == arbitrationContract || hasRole(ADMIN_ROLE, msg.sender), "Only arbitrator/admin");
        require(shipments[_shipmentId].exists);
        disputeActive[_shipmentId] = _active;
    }

    function resolveArbitration(
        uint256 _shipmentId,
        uint256 _supplierPayout,
        uint256 _carrierPayout
    ) external nonReentrant whenNotPaused {
        Shipment storage s = shipments[_shipmentId];
        require(msg.sender == arbitrationContract && s.exists && s.status != ShipmentStatus.Completed && s.status != ShipmentStatus.Cancelled);

        // Release USYC if wrapped
        if (usycWrapped[_shipmentId]) {
            _redeemUSYC(_shipmentId);
        }

        uint256 platformFee = ((s.cargoValue + s.shippingFee) * 25) / 10000;
        uint256 totalEscrow = s.cargoValue + s.shippingFee;
        
        // Payout validation
        uint256 totalPayouts = _supplierPayout + _carrierPayout + platformFee;
        require(totalPayouts <= totalEscrow);

        // Update state
        s.status = ShipmentStatus.Completed;
        s.pickupTimestamp = block.timestamp;
        s.releasedSupplierAmount = _supplierPayout + s.releasedSupplierAmount;
        s.releasedCarrierAmount = _carrierPayout;
        disputeActive[_shipmentId] = false;

        // Transfers
        if (_supplierPayout > 0) {
            address beneficiary = shipmentBeneficiary[_shipmentId];
            if (beneficiary == address(0)) {
                beneficiary = s.supplier;
            }
            require(IERC20(s.token).transfer(beneficiary, _supplierPayout));
        }
        if (_carrierPayout > 0) {
            require(IERC20(s.token).transfer(s.carrier, _carrierPayout));
        }
        require(IERC20(s.token).transfer(owner, platformFee));

        // Refund any remainder to buyer
        uint256 remainder = totalEscrow - totalPayouts;
        if (remainder > 0) {
            require(IERC20(s.token).transfer(s.buyer, remainder));
        }

        _updatePassport(
            s.passportTokenId,
            "Settled via Dispute Arbitration",
            s.destinationPort,
            1200,
            true
        );

        emit ShipmentCompleted(_shipmentId, _supplierPayout, _carrierPayout, platformFee);
    }

    function pause() external onlyAdmin {
        paused = true;
    }

    function unpause() external onlyAdmin {
        paused = false;
    }

    // Register IoT Gateway Device for a shipment
    function setIotGateway(uint256 _shipmentId, address _gateway) external whenNotPaused {
        Shipment memory s = shipments[_shipmentId];
        require(s.exists && s.status == ShipmentStatus.Created && _gateway != address(0));
        require(msg.sender == s.buyer || hasRole(ADMIN_ROLE, msg.sender), "Only buyer/admin");
        iotGateway[_shipmentId] = _gateway;
        emit IoTGatewayRegistered(_shipmentId, _gateway);
    }

    function createShipment(
        address _supplier,
        address _carrier,
        uint256 _cargoValue,
        uint256 _shippingFee,
        string calldata _departurePort,
        string calldata _destinationPort,
        uint256 _freeTimeHours,
        uint256 _demurrageRatePerHour,
        address _token,
        uint256 _poId
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(passportContract != address(0) && _supplier != address(0) && _carrier != address(0) && _cargoValue >= MIN_ESCROW_VALUE && _shippingFee > 0 && (_token == usdcToken || _token == eurcToken));

        uint256 totalEscrowNeeded = _cargoValue + _shippingFee;
        
        // Transfer USDC/EURC from buyer to this contract
        require(IERC20(_token).transferFrom(msg.sender, address(this), totalEscrowNeeded));

        uint256 shipmentId = nextShipmentId++;
        
        // Mint the digital passport to the buyer
        uint256 passportId = IFreightPassport(passportContract).mint(
            msg.sender, 
            _departurePort, 
            _destinationPort
        );

        shipments[shipmentId] = Shipment({
            id: shipmentId,
            buyer: msg.sender,
            supplier: _supplier,
            carrier: _carrier,
            cargoValue: _cargoValue,
            shippingFee: _shippingFee,
            releasedSupplierAmount: 0,
            releasedCarrierAmount: 0,
            departurePort: _departurePort,
            destinationPort: _destinationPort,
            status: ShipmentStatus.Created,
            arrivedTimestamp: 0,
            customClearanceTimestamp: 0,
            pickupTimestamp: 0,
            freeTimeHours: _freeTimeHours,
            demurrageRatePerHour: _demurrageRatePerHour,
            demurragePenaltyPaid: 0,
            passportTokenId: passportId,
            token: _token,
            exists: true
        });

        _buyerShipments[msg.sender].push(shipmentId);
        _supplierShipments[_supplier].push(shipmentId);
        _carrierShipments[_carrier].push(shipmentId);
        
        // Initialize advanced feature fields
        createdTimestamps[shipmentId] = block.timestamp;
        shipmentBeneficiary[shipmentId] = _supplier;

        // Process PO financing repayment waterfall if linked
        if (poLoans[_poId].supplier != address(0)) {
            POLoan storage po = poLoans[_poId];
            require(po.buyer == msg.sender && po.supplier == _supplier && po.cargoValue == _cargoValue && po.token == _token && po.funded && !po.repaid);

            po.repaid = true;
            shipmentPOLoans[shipmentId] = _poId;
            shipmentHasPOLoan[shipmentId] = true;
            
            // Repay investor loan immediately
            require(IERC20(_token).transfer(po.investor, po.repaymentAmount));
            
            // Set releasedSupplierAmount to the loan repayment amount since they already received funds
            shipments[shipmentId].releasedSupplierAmount = po.repaymentAmount;
            
            emit POFinancingRepaid(_poId, po.investor, po.repaymentAmount);
        }

        emit ShipmentCreated(shipmentId, msg.sender, _supplier, _carrier, passportId, _token);
        return shipmentId;
    }

    function _checkTemperature(uint256 _shipmentId, int256 _temp, string memory _location) internal {
        if (_temp > MAX_TEMPERATURE_LIMIT) {
            temperatureViolations[_shipmentId]++;
            emit TemperatureViolationLogged(_shipmentId, _location, _temp, temperatureViolations[_shipmentId]);
        }
    }

    function _updatePassport(uint256 _tokenId, string memory _status, string memory _location, int256 _temp, bool _completed) internal {
        if (passportContract != address(0)) {
            IFreightPassport(passportContract).updatePassport(_tokenId, _status, _location, _temp, _completed);
        }
    }

    function _departure(uint256 _shipmentId, int256 _temp, bool isIot) internal {
        Shipment storage s = shipments[_shipmentId];
        require(s.exists && s.status == ShipmentStatus.Created && (!cctpFundingRequired[_shipmentId] || cctpSourceTxHash[_shipmentId] != bytes32(0)));
        s.status = ShipmentStatus.InTransit;
        _checkTemperature(_shipmentId, _temp, s.departurePort);
        _updatePassport(
            s.passportTokenId, 
            isIot ? "In Transit (IoT Verified)" : "In Transit", 
            s.departurePort, 
            _temp, 
            false
        );
        emit MilestoneReached(
            _shipmentId, 
            isIot ? "IoT Departure" : "Departure", 
            s.departurePort, 
            _temp, 
            0
        );
    }

    function _singapore(uint256 _shipmentId, int256 _temp, bool isIot) internal {
        Shipment storage s = shipments[_shipmentId];
        require(s.exists && s.status == ShipmentStatus.InTransit && !singaporeMilestonePaid[_shipmentId] && !shipmentHasPOLoan[_shipmentId]);

        singaporeMilestonePaid[_shipmentId] = true;
        uint256 payout = (s.cargoValue * 30) / 100;
        s.releasedSupplierAmount += payout;

        _checkTemperature(_shipmentId, _temp, "Singapore Port");

        address beneficiary = shipmentBeneficiary[_shipmentId];
        if (beneficiary == address(0)) {
            beneficiary = s.supplier;
        }
        require(IERC20(s.token).transfer(beneficiary, payout));

        _updatePassport(
            s.passportTokenId, 
            isIot ? "Singapore (IoT Verified, 30% Payout)" : "In Transit - Singapore Checkpoint Passed (30% Payout Released)", 
            "Singapore Port", 
            _temp, 
            false
        );
        emit MilestoneReached(
            _shipmentId, 
            isIot ? "IoT Singapore Checkpoint" : "Singapore Checkpoint", 
            "Singapore Port", 
            _temp, 
            payout
        );
    }

    function _arrival(uint256 _shipmentId, int256 _temp, bool isIot) internal {
        Shipment storage s = shipments[_shipmentId];
        require(s.exists && s.status == ShipmentStatus.InTransit);
        s.status = ShipmentStatus.Arrived;
        s.arrivedTimestamp = block.timestamp;
        _checkTemperature(_shipmentId, _temp, s.destinationPort);
        _updatePassport(
            s.passportTokenId, 
            isIot ? "Arrived (IoT Verified)" : "Arrived at Destination Port", 
            s.destinationPort, 
            _temp, 
            false
        );
        emit MilestoneReached(
            _shipmentId, 
            isIot ? "IoT Arrival" : "Arrival", 
            s.destinationPort, 
            _temp, 
            0
        );
    }

    function _customs(uint256 _shipmentId, int256 _temp, bool isIot) internal {
        Shipment storage s = shipments[_shipmentId];
        require(s.exists && s.status == ShipmentStatus.Arrived);
        s.status = ShipmentStatus.CustomCleared;
        s.customClearanceTimestamp = block.timestamp;
        _checkTemperature(_shipmentId, _temp, s.destinationPort);
        _updatePassport(
            s.passportTokenId, 
            isIot ? "Customs Cleared (IoT Verified)" : "Customs Cleared - Awaiting Pickup", 
            s.destinationPort, 
            _temp, 
            false
        );
        emit MilestoneReached(
            _shipmentId, 
            isIot ? "IoT Customs" : "Customs Clearance", 
            s.destinationPort, 
            _temp, 
            0
        );
    }

    function triggerMilestoneDeparture(uint256 _shipmentId, int256 _temp) external onlyOracle whenNotPaused {
        _departure(_shipmentId, _temp, false);
    }

    function triggerMilestoneSingapore(uint256 _shipmentId, int256 _temp) external onlyOracle nonReentrant whenNotPaused {
        _singapore(_shipmentId, _temp, false);
    }

    function triggerMilestoneArrived(uint256 _shipmentId, int256 _temp) external onlyOracle whenNotPaused {
        _arrival(_shipmentId, _temp, false);
    }

    function triggerCustomClearance(uint256 _shipmentId, int256 _temp) external onlyOracle whenNotPaused {
        _customs(_shipmentId, _temp, false);
    }

    function getDemurragePenalty(uint256 _shipmentId) public view returns (uint256 hoursLate, uint256 penaltyAmount) {
        Shipment memory s = shipments[_shipmentId];
        if (s.status != ShipmentStatus.CustomCleared) {
            return (0, 0);
        }

        uint256 timePassed = block.timestamp - s.customClearanceTimestamp;
        uint256 freeTimeSeconds = s.freeTimeHours * 3600;

        if (timePassed > freeTimeSeconds) {
            uint256 lateSeconds = timePassed - freeTimeSeconds;
            // Round up to the nearest hour
            hoursLate = (lateSeconds + 3599) / 3600;
            penaltyAmount = hoursLate * s.demurrageRatePerHour;
        } else {
            hoursLate = 0;
            penaltyAmount = 0;
        }
    }

    function pickupCargo(uint256 _shipmentId) external nonReentrant whenNotPaused holdSettlement(_shipmentId) {
        Shipment storage s = shipments[_shipmentId];
        require(s.exists && s.status == ShipmentStatus.CustomCleared && (msg.sender == s.buyer || hasRole(ORACLE_ROLE, msg.sender)));

        // Auto-redeem USYC if wrapped
        if (usycWrapped[_shipmentId]) {
            _redeemUSYC(_shipmentId);
        }

        (uint256 hoursLate, uint256 penaltyAmount) = getDemurragePenalty(_shipmentId);

        // Calculate Payouts and Platform Fees
        // Platform fee is 0.25% of cargoValue + shippingFee
        uint256 platformFee = ((s.cargoValue + s.shippingFee) * 25) / 10000;
        
        // Payout supplier (remaining cargoValue minus platform fee share)
        uint256 supplierRemaining = s.cargoValue - s.releasedSupplierAmount;
        uint256 supplierPlatformFee = (s.cargoValue * 25) / 10000;
        uint256 finalSupplierPayout = 0;
        
        if (supplierRemaining > supplierPlatformFee) {
            finalSupplierPayout = supplierRemaining - supplierPlatformFee;
        }

        // Apply temperature violation penalty (5% of cargoValue per violation)
        uint256 violationCount = temperatureViolations[_shipmentId];
        uint256 tempPenalty = 0;
        if (violationCount > 0) {
            tempPenalty = (s.cargoValue * (violationCount * 5)) / 100;
            if (tempPenalty > finalSupplierPayout) {
                tempPenalty = finalSupplierPayout;
            }
        }

        uint256 finalPayoutAfterPenalty = finalSupplierPayout - tempPenalty;

        // Payout carrier (shippingFee minus platform fee share)
        uint256 carrierPlatformFee = (s.shippingFee * 25) / 10000;
        uint256 finalCarrierPayout = s.shippingFee - carrierPlatformFee;

        // ─── EFFECTS (Perform all state updates before external transfers) ───
        s.pickupTimestamp = block.timestamp;
        s.status = ShipmentStatus.Completed;
        s.releasedSupplierAmount += finalSupplierPayout;
        s.releasedCarrierAmount = finalCarrierPayout;

        if (penaltyAmount > 0) {
            s.demurragePenaltyPaid = penaltyAmount;
        }
        if (tempPenalty > 0) {
            temperaturePenalties[_shipmentId] = tempPenalty;
        }

        uint256 realYield = yieldEarned[_shipmentId];

        // ─── INTERACTIONS (Perform all external contract calls/transfers) ───
        if (penaltyAmount > 0) {
            require(IERC20(s.token).transferFrom(msg.sender, s.carrier, penaltyAmount));
            emit DemurrageCharged(_shipmentId, hoursLate, penaltyAmount);
        }

        if (tempPenalty > 0) {
            // Refund penalty to buyer
            require(IERC20(s.token).transfer(s.buyer, tempPenalty));
        }

        address beneficiary = shipmentBeneficiary[_shipmentId];
        if (beneficiary == address(0)) {
            beneficiary = s.supplier;
        }

        if (finalPayoutAfterPenalty > 0) {
            require(IERC20(s.token).transfer(beneficiary, finalPayoutAfterPenalty));
        }

        require(IERC20(s.token).transfer(s.carrier, finalCarrierPayout));
        require(IERC20(s.token).transfer(owner, platformFee));

        if (realYield > 0) {
            require(IERC20(s.token).transfer(s.buyer, realYield));
        }

        // Update Cargo Passport to Completed
        _updatePassport(
            s.passportTokenId,
            "Cargo Delivered & Payments Settled",
            s.destinationPort,
            1200, // standard room temperature
            true
        );

        emit ShipmentCompleted(_shipmentId, finalPayoutAfterPenalty, finalCarrierPayout, platformFee);
    }

    function cancelShipment(uint256 _shipmentId) external nonReentrant whenNotPaused {
        Shipment storage s = shipments[_shipmentId];
        require(s.exists && s.status == ShipmentStatus.Created && (msg.sender == s.buyer || hasRole(ADMIN_ROLE, msg.sender)));

        // Auto-redeem USYC if wrapped
        if (usycWrapped[_shipmentId]) {
            _redeemUSYC(_shipmentId);
        }

        s.status = ShipmentStatus.Cancelled;

        uint256 refundAmount = s.cargoValue + s.shippingFee;
        
        // If PO was repaid, we refund the buyer minus the loan advance they financed
        if (shipmentHasPOLoan[_shipmentId]) {
            POLoan memory po = poLoans[shipmentPOLoans[_shipmentId]];
            refundAmount = refundAmount - po.repaymentAmount;
        }

        require(IERC20(s.token).transfer(s.buyer, refundAmount));

        _updatePassport(
            s.passportTokenId,
            "Shipment Cancelled & Funds Refunded",
            s.departurePort,
            0,
            true
        );

        emit ShipmentCancelled(_shipmentId);
    }

    function payoutCrew(
        uint256 _shipmentId,
        address[] calldata _crew,
        uint256[] calldata _amounts
    ) external nonReentrant whenNotPaused {
        Shipment memory s = shipments[_shipmentId];
        require(s.exists);
        require(s.status == ShipmentStatus.Completed);
        require(msg.sender == s.carrier);
        require(_crew.length == _amounts.length);
        require(_crew.length > 0 && _crew.length <= 50);

        uint256 totalPayout = 0;
        for (uint256 i = 0; i < _amounts.length; i++) {
            totalPayout += _amounts[i];
        }

        // Verify the carrier has enough balance
        require(IERC20(s.token).balanceOf(msg.sender) >= totalPayout);

        // Distribute funds
        for (uint256 i = 0; i < _crew.length; i++) {
            require(IERC20(s.token).transferFrom(msg.sender, _crew[i], _amounts[i]));
        }

        emit CarrierPayrollPaid(_shipmentId, msg.sender, totalPayout, _crew.length);
    }



    // Advanced features functions: Factoring
    function offerShipmentForFactoring(uint256 _shipmentId, uint256 _price) external whenNotPaused {
        Shipment memory s = shipments[_shipmentId];
        require(s.exists && msg.sender == s.supplier && (s.status == ShipmentStatus.Created || s.status == ShipmentStatus.InTransit) && shipmentBeneficiary[_shipmentId] == s.supplier && _price > 0 && _price < s.cargoValue);

        factoringOffers[_shipmentId] = FactoringOffer({
            price: _price,
            active: true,
            investor: address(0)
        });

        emit FactoringOffered(_shipmentId, msg.sender, _price);
    }

    function cancelFactoringOffer(uint256 _shipmentId) external whenNotPaused {
        Shipment memory s = shipments[_shipmentId];
        require(s.exists && msg.sender == s.supplier && factoringOffers[_shipmentId].active);

        factoringOffers[_shipmentId].active = false;

        emit FactoringCancelled(_shipmentId, msg.sender);
    }

    function purchaseFactoredShipment(uint256 _shipmentId) external nonReentrant whenNotPaused {
        Shipment memory s = shipments[_shipmentId];
        FactoringOffer storage offer = factoringOffers[_shipmentId];
        require(s.exists && offer.active && msg.sender != s.supplier);

        offer.active = false;
        offer.investor = msg.sender;
        shipmentBeneficiary[_shipmentId] = msg.sender;

        // Transfer price in USDC/EURC from investor to supplier
        require(IERC20(s.token).transferFrom(msg.sender, s.supplier, offer.price));

        emit FactoringPurchased(_shipmentId, s.supplier, msg.sender, offer.price);
    }

    // Advanced features functions: PO Financing
    function requestPOFinancing(
        address _buyer,
        uint256 _cargoValue,
        uint256 _loanAmount,
        address _token
    ) external whenNotPaused returns (uint256) {
        require(_buyer != address(0) && _cargoValue >= MIN_ESCROW_VALUE && _loanAmount > 0 && _loanAmount <= (_cargoValue * 80) / 100 && _loanAmount <= MAX_PO_LOAN_CAP && (_token == usdcToken || _token == eurcToken));

        uint256 poId = nextPOId++;
        
        // 5% interest
        uint256 repaymentAmt = _loanAmount + (_loanAmount * 5) / 100;

        poLoans[poId] = POLoan({
            id: poId,
            supplier: msg.sender,
            buyer: _buyer,
            cargoValue: _cargoValue,
            loanRequested: _loanAmount,
            repaymentAmount: repaymentAmt,
            investor: address(0),
            funded: false,
            repaid: false,
            token: _token
        });

        emit POFinancingRequested(poId, msg.sender, _buyer, _cargoValue, _loanAmount, _token);
        return poId;
    }

    function fundPOLoan(uint256 _poId) external nonReentrant whenNotPaused {
        POLoan storage po = poLoans[_poId];
        require(po.supplier != address(0) && !po.funded && msg.sender != po.supplier);

        po.funded = true;
        po.investor = msg.sender;

        // Transfer principal from investor to supplier
        require(IERC20(po.token).transferFrom(msg.sender, po.supplier, po.loanRequested));

        emit POFinancingFunded(_poId, msg.sender, po.loanRequested);
    }

    // ─── IoT Cryptographic Signature Verification ───

    function triggerMilestoneWithIoTSignature(
        uint256 _shipmentId,
        string calldata _milestoneType,
        int256 _temperature,
        uint256 _humidity,
        uint256 _timestamp,
        bytes calldata _signature
    ) external nonReentrant whenNotPaused {
        Shipment storage s = shipments[_shipmentId];
        address gateway = iotGateway[_shipmentId];
        require(s.exists && gateway != address(0) && _signature.length == 65);

        bytes32 ethSignedHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            keccak256(abi.encodePacked(
                _shipmentId,
                _milestoneType,
                _temperature,
                _humidity,
                _timestamp
            ))
        ));

        bytes32 r;
        bytes32 sv;
        uint8 v;
        assembly {
            r := calldataload(_signature.offset)
            sv := calldataload(add(_signature.offset, 32))
            v := byte(0, calldataload(add(_signature.offset, 64)))
        }
        if (v < 27) v += 27;
        require((v == 27 || v == 28) && ecrecover(ethSignedHash, v, r, sv) == gateway);

        emit IoTSignatureVerified(_shipmentId, gateway, _milestoneType, _temperature, _humidity);

        // Store humidity data
        humidityData[_shipmentId] = _humidity;

        // Route to appropriate milestone logic and call temperature SLA check with correct location
        bytes32 milestoneHash = keccak256(bytes(_milestoneType));

        if (milestoneHash == keccak256("departure")) {
            _departure(_shipmentId, _temperature, true);
        } else if (milestoneHash == keccak256("singapore")) {
            _singapore(_shipmentId, _temperature, true);
        } else if (milestoneHash == keccak256("arrival")) {
            _arrival(_shipmentId, _temperature, true);
        } else if (milestoneHash == keccak256("customs")) {
            _customs(_shipmentId, _temperature, true);
        } else {
            revert();
        }
    }

    // ─── USYC Yield-Bearing Vault Wrapping ───

    function wrapEscrowInUSYC(uint256 _shipmentId) external onlyOperator nonReentrant whenNotPaused {
        Shipment memory s = shipments[_shipmentId];
        require(s.exists);
        require(s.status == ShipmentStatus.Created);
        require(usycVault != address(0));
        require(!usycWrapped[_shipmentId]);

        uint256 escrowBalance = s.cargoValue + s.shippingFee - s.releasedSupplierAmount;
        require(escrowBalance > 0);

        // Approve USYC vault to pull USDC
        // Using low-level call since IERC20 only has transfer/transferFrom
        (bool approveSuccess,) = s.token.call(
            abi.encodeWithSignature("approve(address,uint256)", usycVault, escrowBalance)
        );
        require(approveSuccess);

        uint256 shares = IMockUSYC(usycVault).deposit(escrowBalance, address(this));
        usycShares[_shipmentId] = shares;
        usycWrapped[_shipmentId] = true;

        emit EscrowWrappedInUSYC(_shipmentId, escrowBalance, shares);
    }

    function _redeemUSYC(uint256 _shipmentId) internal returns (uint256 assetsReturned) {
        if (!usycWrapped[_shipmentId] || usycShares[_shipmentId] == 0) return 0;

        Shipment memory s = shipments[_shipmentId];
        uint256 shares = usycShares[_shipmentId];

        assetsReturned = IMockUSYC(usycVault).redeem(shares, address(this), address(this));

        uint256 principal = s.cargoValue + s.shippingFee - s.releasedSupplierAmount;
        uint256 yieldAmount = 0;
        if (assetsReturned > principal) {
            yieldAmount = assetsReturned - principal;
        }

        usycShares[_shipmentId] = 0;
        usycWrapped[_shipmentId] = false;
        yieldEarned[_shipmentId] = yieldAmount;

        emit EscrowRedeemedFromUSYC(_shipmentId, shares, assetsReturned, yieldAmount);
    }

    function redeemUSYCForShipment(uint256 _shipmentId) external onlyOperator nonReentrant whenNotPaused returns (uint256 assetsReturned) {
        require(usycWrapped[_shipmentId]);
        require(usycShares[_shipmentId] > 0);
        return _redeemUSYC(_shipmentId);
    }

    // Allow creating a shipment with pending CCTP funding
    function createShipmentWithCCTPPending(
        address _supplier,
        address _carrier,
        uint256 _cargoValue,
        uint256 _shippingFee,
        string calldata _departurePort,
        string calldata _destinationPort,
        uint256 _freeTimeHours,
        uint256 _demurrageRatePerHour,
        address _token
    ) external whenNotPaused returns (uint256) {
        require(passportContract != address(0));
        require(_supplier != address(0) && _carrier != address(0));
        require(_cargoValue >= MIN_ESCROW_VALUE);
        require(_shippingFee > 0);
        require(_token == usdcToken || _token == eurcToken);

        uint256 shipmentId = nextShipmentId++;
        
        // Mint the digital passport to the buyer
        uint256 passportId = IFreightPassport(passportContract).mint(
            msg.sender, 
            _departurePort, 
            _destinationPort
        );

        shipments[shipmentId] = Shipment({
            id: shipmentId,
            buyer: msg.sender,
            supplier: _supplier,
            carrier: _carrier,
            cargoValue: _cargoValue,
            shippingFee: _shippingFee,
            releasedSupplierAmount: 0,
            releasedCarrierAmount: 0,
            departurePort: _departurePort,
            destinationPort: _destinationPort,
            status: ShipmentStatus.Created,
            arrivedTimestamp: 0,
            customClearanceTimestamp: 0,
            pickupTimestamp: 0,
            freeTimeHours: _freeTimeHours,
            demurrageRatePerHour: _demurrageRatePerHour,
            demurragePenaltyPaid: 0,
            passportTokenId: passportId,
            token: _token,
            exists: true
        });

        _buyerShipments[msg.sender].push(shipmentId);
        _supplierShipments[_supplier].push(shipmentId);
        _carrierShipments[_carrier].push(shipmentId);
        
        createdTimestamps[shipmentId] = block.timestamp;
        shipmentBeneficiary[shipmentId] = _supplier;

        // Note: we do not pull funds from msg.sender here.
        // It will be funded via recordCCTPFunding.
        cctpFundingRequired[shipmentId] = true;

        emit ShipmentCreated(shipmentId, msg.sender, _supplier, _carrier, passportId, _token);
        return shipmentId;
    }

    // ─── CCTP Cross-Chain Bridge Receiver ───

    function parseCCTPMessage(bytes calldata message) public pure returns (
        uint32 sourceDomain,
        uint256 amount,
        address mintRecipient
    ) {
        require(message.length >= 248);
        
        // Extract sourceDomain (bytes 4-7)
        sourceDomain = uint32(bytes4(message[4:8]));
        
        // Extract amount (bytes 184-215)
        amount = uint256(bytes32(message[184:216]));
        
        // Extract mintRecipient (bytes 152-183) - take the last 20 bytes
        mintRecipient = address(uint160(uint256(bytes32(message[152:184]))));
    }

    function recordCCTPFunding(
        uint256 _shipmentId,
        bytes32 _sourceTxHash,
        bytes calldata _message
    ) external nonReentrant whenNotPaused {
        Shipment storage s = shipments[_shipmentId];
        // Extract nonce (bytes 12-19) to compute sourceAndNonce first
        (uint32 domain, uint256 amt, address recipient) = parseCCTPMessage(_message);
        uint64 nonce = uint64(bytes8(_message[12:20]));
        bytes32 sourceAndNonce = keccak256(abi.encodePacked(domain, nonce));

        require(s.exists && s.status == ShipmentStatus.Created && (recipient == s.buyer || recipient == address(this)));
        uint256 totalEscrowNeeded = s.cargoValue + s.shippingFee;
        require(amt >= totalEscrowNeeded && IMessageTransmitter(MESSAGE_TRANSMITTER).usedNonces(sourceAndNonce) > 0 && !processedCCTPNonces[sourceAndNonce]);

        processedCCTPNonces[sourceAndNonce] = true;

        // Record CCTP info
        cctpSourceTxHash[_shipmentId] = _sourceTxHash;
        cctpSourceDomain[_shipmentId] = domain;

        // Pull the minted USDC from the buyer to the escrow contract if they minted to themselves.
        // If they minted directly to the contract, the funds are already here.
        if (recipient == s.buyer) {
            require(IERC20(s.token).transferFrom(s.buyer, address(this), totalEscrowNeeded));
        }

        emit CCTPFundingReceived(_shipmentId, domain, _sourceTxHash, amt);
    }
}
