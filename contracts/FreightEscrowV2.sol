// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

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

contract FreightEscrowV2 is 
    Initializable, 
    AccessControlUpgradeable, 
    ReentrancyGuardUpgradeable, 
    PausableUpgradeable, 
    UUPSUpgradeable 
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    address public owner;
    address public usdcToken;
    address public eurcToken;
    address public passportContract;

    enum ShipmentStatus { Created, InTransit, Arrived, CustomCleared, Completed, Cancelled }

    struct Shipment {
        uint256 id;
        address buyer;
        address supplier;
        address carrier;
        uint256 cargoValue;
        uint256 shippingFee;
        uint256 releasedSupplierAmount;
        uint256 releasedCarrierAmount;
        string departurePort;
        string destinationPort;
        ShipmentStatus status;
        uint256 arrivedTimestamp;
        uint256 customClearanceTimestamp;
        uint256 pickupTimestamp;
        uint256 freeTimeHours;
        uint256 demurrageRatePerHour;
        uint256 demurragePenaltyPaid;
        uint256 passportTokenId;
        address token;
        bool exists;
    }

    uint256 public nextShipmentId;
    mapping(uint256 => Shipment) public shipments;
    mapping(address => uint256[]) private _buyerShipments;
    mapping(address => uint256[]) private _supplierShipments;
    mapping(address => uint256[]) private _carrierShipments;

    struct FactoringOffer {
        uint256 price;
        bool active;
        address investor;
    }
    
    uint256 public constant USYC_APY_BPS = 500;
    int256 public constant MAX_TEMPERATURE_LIMIT = 800;
    uint256 public constant MIN_ESCROW_VALUE = 1e6;
    uint256 public constant MAX_PO_LOAN_CAP = 1_000_000 * 1e6;

    mapping(uint256 => FactoringOffer) public factoringOffers;
    mapping(uint256 => address) public shipmentBeneficiary;
    mapping(uint256 => uint256) public temperatureViolations;
    mapping(uint256 => uint256) public createdTimestamps;
    mapping(uint256 => uint256) public yieldEarned;
    mapping(uint256 => uint256) public temperaturePenalties;
    mapping(uint256 => bool) public singaporeMilestonePaid;

    mapping(uint256 => address) public iotGateway;
    mapping(uint256 => uint256) public humidityData;

    address public usycVault;
    mapping(uint256 => uint256) public usycShares;
    mapping(uint256 => bool) public usycWrapped;

    mapping(uint256 => bytes32) public cctpSourceTxHash;
    mapping(uint256 => uint32) public cctpSourceDomain;
    mapping(bytes32 => bool) public processedCCTPNonces;
    mapping(uint256 => bool) public cctpFundingRequired;

    address public constant TOKEN_MESSENGER = 0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA;
    address public constant MESSAGE_TRANSMITTER = 0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275;

    address public oracleContract;

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
    mapping(uint256 => uint256) public shipmentPOLoans;
    mapping(uint256 => bool) public shipmentHasPOLoan;

    event ShipmentCreated(uint256 indexed shipmentId, address indexed buyer, address indexed supplier, address carrier, uint256 passportId, address token);
    event MilestoneReached(uint256 indexed shipmentId, string milestoneName, string location, int256 temperature, uint256 payoutAmount);
    event DemurrageCharged(uint256 indexed shipmentId, uint256 hoursLate, uint256 penaltyAmount);
    event ShipmentCompleted(uint256 indexed shipmentId, uint256 supplierPayout, uint256 carrierPayout, uint256 platformFee);
    event ShipmentCancelled(uint256 indexed shipmentId);
    event CarrierPayrollPaid(uint256 indexed shipmentId, address indexed carrier, uint256 totalAmount, uint256 crewCount);

    event FactoringOffered(uint256 indexed shipmentId, address indexed supplier, uint256 price);
    event FactoringCancelled(uint256 indexed shipmentId, address indexed supplier);
    event FactoringPurchased(uint256 indexed shipmentId, address indexed supplier, address indexed investor, uint256 price);
    event TemperatureViolationLogged(uint256 indexed shipmentId, string location, int256 temperature, uint256 totalViolations);

    event POFinancingRequested(uint256 indexed poId, address indexed supplier, address indexed buyer, uint256 cargoValue, uint256 loanRequested, address token);
    event POFinancingFunded(uint256 indexed poId, address indexed investor, uint256 loanAmount);
    event POFinancingRepaid(uint256 indexed poId, address indexed investor, uint256 repaymentAmount);

    event IoTGatewayRegistered(uint256 indexed shipmentId, address indexed gateway);
    event IoTSignatureVerified(uint256 indexed shipmentId, address indexed signer, string milestoneType, int256 temperature, uint256 humidity);

    event EscrowWrappedInUSYC(uint256 indexed shipmentId, uint256 assets, uint256 shares);
    event EscrowRedeemedFromUSYC(uint256 indexed shipmentId, uint256 shares, uint256 assetsReturned, uint256 yieldGenerated);

    event CCTPFundingReceived(uint256 indexed shipmentId, uint32 sourceDomain, bytes32 sourceTxHash, uint256 amount);

    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "Only Admin");
        _;
    }

    modifier onlyOracle() {
        require(hasRole(ORACLE_ROLE, msg.sender) || msg.sender == oracleContract, "Only Oracle");
        _;
    }

    modifier onlyOperator() {
        require(hasRole(OPERATOR_ROLE, msg.sender), "Only Operator");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _usdcToken, address _eurcToken) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        owner = msg.sender;
        usdcToken = _usdcToken;
        eurcToken = _eurcToken;

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        _setupRole(ORACLE_ROLE, msg.sender);
        _setupRole(OPERATOR_ROLE, msg.sender);

        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
        _setRoleAdmin(ORACLE_ROLE, ADMIN_ROLE);
        _setRoleAdmin(OPERATOR_ROLE, ADMIN_ROLE);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyAdmin {}

    function version() external pure returns (string memory) {
        return "V2";
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

    // Register IoT Gateway Device for a shipment
    function setIotGateway(uint256 _shipmentId, address _gateway) external whenNotPaused {
        Shipment memory s = shipments[_shipmentId];
        require(s.exists, "Shipment does not exist");
        require(msg.sender == s.buyer || hasRole(ADMIN_ROLE, msg.sender), "Only buyer/admin");
        require(s.status == ShipmentStatus.Created, "Set before transit");
        require(_gateway != address(0), "Invalid gateway address");
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
        require(passportContract != address(0), "No passport");
        require(_supplier != address(0) && _carrier != address(0), "Bad addresses");
        require(_cargoValue >= MIN_ESCROW_VALUE, "Escrow below minimum value");
        require(_shippingFee > 0, "Bad shipping fee");
        require(_token == usdcToken || _token == eurcToken, "Bad token");

        uint256 totalEscrowNeeded = _cargoValue + _shippingFee;
        
        require(
            IERC20(_token).transferFrom(msg.sender, address(this), totalEscrowNeeded),
            "Deposit failed"
        );

        uint256 shipmentId = nextShipmentId++;
        
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

        if (poLoans[_poId].supplier != address(0)) {
            POLoan storage po = poLoans[_poId];
            require(po.buyer == msg.sender, "PO buyer mismatch");
            require(po.supplier == _supplier, "PO supplier mismatch");
            require(po.cargoValue == _cargoValue, "PO cargo mismatch");
            require(po.token == _token, "PO token mismatch");
            require(po.funded, "PO not funded");
            require(!po.repaid, "PO repaid");

            po.repaid = true;
            shipmentPOLoans[shipmentId] = _poId;
            shipmentHasPOLoan[shipmentId] = true;
            
            require(
                IERC20(_token).transfer(po.investor, po.repaymentAmount),
                "PO repayment failed"
            );
            
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

    function triggerMilestoneDeparture(uint256 _shipmentId, int256 _temp) external onlyOracle whenNotPaused {
        Shipment storage s = shipments[_shipmentId];
        require(s.exists, "No shipment");
        require(s.status == ShipmentStatus.Created, "Bad status");

        if (cctpFundingRequired[_shipmentId]) {
            require(cctpSourceTxHash[_shipmentId] != bytes32(0), "Shipment not funded yet via CCTP");
        }

        s.status = ShipmentStatus.InTransit;
        
        _checkTemperature(_shipmentId, _temp, s.departurePort);
        
        IFreightPassport(passportContract).updatePassport(
            s.passportTokenId, 
            "In Transit", 
            s.departurePort, 
            _temp, 
            false
        );

        emit MilestoneReached(_shipmentId, "Departure", s.departurePort, _temp, 0);
    }

    function triggerMilestoneSingapore(uint256 _shipmentId, int256 _temp) external onlyOracle nonReentrant whenNotPaused {
        Shipment storage s = shipments[_shipmentId];
        require(s.exists, "No shipment");
        require(s.status == ShipmentStatus.InTransit, "Bad status");
        require(!singaporeMilestonePaid[_shipmentId], "Already paid");
        require(!shipmentHasPOLoan[_shipmentId], "PO financed");

        singaporeMilestonePaid[_shipmentId] = true;

        uint256 payout = (s.cargoValue * 30) / 100;
        s.releasedSupplierAmount += payout;

        _checkTemperature(_shipmentId, _temp, "Singapore Port");

        address beneficiary = shipmentBeneficiary[_shipmentId];
        if (beneficiary == address(0)) {
            beneficiary = s.supplier;
        }

        require(
            IERC20(s.token).transfer(beneficiary, payout),
            "Payout failed"
        );

        IFreightPassport(passportContract).updatePassport(
            s.passportTokenId, 
            "In Transit - Singapore Checkpoint Passed (30% Payout Released)", 
            "Singapore Port", 
            _temp, 
            false
        );

        emit MilestoneReached(_shipmentId, "Singapore Checkpoint", "Singapore Port", _temp, payout);
    }

    function triggerMilestoneArrived(uint256 _shipmentId, int256 _temp) external onlyOracle whenNotPaused {
        Shipment storage s = shipments[_shipmentId];
        require(s.exists, "No shipment");
        require(s.status == ShipmentStatus.InTransit, "Bad status");

        s.status = ShipmentStatus.Arrived;
        s.arrivedTimestamp = block.timestamp;

        _checkTemperature(_shipmentId, _temp, s.destinationPort);

        IFreightPassport(passportContract).updatePassport(
            s.passportTokenId, 
            "Arrived at Destination Port", 
            s.destinationPort, 
            _temp, 
            false
        );

        emit MilestoneReached(_shipmentId, "Arrival", s.destinationPort, _temp, 0);
    }

    function triggerCustomClearance(uint256 _shipmentId, int256 _temp) external onlyOracle whenNotPaused {
        Shipment storage s = shipments[_shipmentId];
        require(s.exists, "No shipment");
        require(s.status == ShipmentStatus.Arrived, "Bad status");

        s.status = ShipmentStatus.CustomCleared;
        s.customClearanceTimestamp = block.timestamp;

        _checkTemperature(_shipmentId, _temp, s.destinationPort);

        IFreightPassport(passportContract).updatePassport(
            s.passportTokenId, 
            "Customs Cleared - Awaiting Pickup", 
            s.destinationPort, 
            _temp, 
            false
        );

        emit MilestoneReached(_shipmentId, "Customs Clearance", s.destinationPort, _temp, 0);
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
            hoursLate = (lateSeconds + 3599) / 3600;
            penaltyAmount = hoursLate * s.demurrageRatePerHour;
        } else {
            hoursLate = 0;
            penaltyAmount = 0;
        }
    }

    function pickupCargo(uint256 _shipmentId) external nonReentrant whenNotPaused {
        Shipment storage s = shipments[_shipmentId];
        require(s.exists, "No shipment");
        require(s.status == ShipmentStatus.CustomCleared, "Not cleared");
        require(msg.sender == s.buyer, "Only buyer");

        if (usycWrapped[_shipmentId]) {
            _redeemUSYC(_shipmentId);
        }

        (uint256 hoursLate, uint256 penaltyAmount) = getDemurragePenalty(_shipmentId);

        uint256 platformFee = ((s.cargoValue + s.shippingFee) * 25) / 10000;
        
        uint256 supplierRemaining = s.cargoValue - s.releasedSupplierAmount;
        uint256 supplierPlatformFee = (s.cargoValue * 25) / 10000;
        uint256 finalSupplierPayout = 0;
        
        if (supplierRemaining > supplierPlatformFee) {
            finalSupplierPayout = supplierRemaining - supplierPlatformFee;
        }

        uint256 violationCount = temperatureViolations[_shipmentId];
        uint256 tempPenalty = 0;
        if (violationCount > 0) {
            tempPenalty = (s.cargoValue * (violationCount * 5)) / 100;
            if (tempPenalty > finalSupplierPayout) {
                tempPenalty = finalSupplierPayout;
            }
        }

        uint256 finalPayoutAfterPenalty = finalSupplierPayout - tempPenalty;

        uint256 carrierPlatformFee = (s.shippingFee * 25) / 10000;
        uint256 finalCarrierPayout = s.shippingFee - carrierPlatformFee;

        // Effects
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
        uint256 simulatedYield = 0;
        if (realYield == 0) {
            uint256 createdTime = createdTimestamps[_shipmentId];
            if (createdTime > 0) {
                uint256 elapsed = block.timestamp - createdTime;
                uint256 escrowedAmount = s.cargoValue + s.shippingFee;
                simulatedYield = (escrowedAmount * USYC_APY_BPS * elapsed) / (10000 * 365 days);
                
                if (simulatedYield > 0) {
                    uint256 contractBal = IERC20(s.token).balanceOf(address(this));
                    uint256 totalFinalPayouts = finalPayoutAfterPenalty + finalCarrierPayout + platformFee;
                    if (contractBal >= totalFinalPayouts + simulatedYield) {
                        yieldEarned[_shipmentId] = simulatedYield;
                    } else {
                        simulatedYield = 0;
                    }
                }
            }
        }

        // Interactions
        if (penaltyAmount > 0) {
            require(
                IERC20(s.token).transferFrom(msg.sender, s.carrier, penaltyAmount),
                "Demurrage failed"
            );
            emit DemurrageCharged(_shipmentId, hoursLate, penaltyAmount);
        }

        if (tempPenalty > 0) {
            require(
                IERC20(s.token).transfer(s.buyer, tempPenalty),
                "Refund failed"
            );
        }

        address beneficiary = shipmentBeneficiary[_shipmentId];
        if (beneficiary == address(0)) {
            beneficiary = s.supplier;
        }

        if (finalPayoutAfterPenalty > 0) {
            require(
                IERC20(s.token).transfer(beneficiary, finalPayoutAfterPenalty),
                "Transfer failed"
            );
        }

        require(
            IERC20(s.token).transfer(s.carrier, finalCarrierPayout),
            "Transfer failed"
        );
        require(
            IERC20(s.token).transfer(owner, platformFee),
            "Transfer failed"
        );

        if (realYield > 0) {
            require(
                IERC20(s.token).transfer(s.buyer, realYield),
                "Transfer failed"
            );
        } else if (simulatedYield > 0) {
            require(
                IERC20(s.token).transfer(s.buyer, simulatedYield),
                "Transfer failed"
            );
        }

        IFreightPassport(passportContract).updatePassport(
            s.passportTokenId,
            "Cargo Delivered & Payments Settled",
            s.destinationPort,
            1200,
            true
        );

        emit ShipmentCompleted(_shipmentId, finalPayoutAfterPenalty, finalCarrierPayout, platformFee);
    }

    function cancelShipment(uint256 _shipmentId) external nonReentrant whenNotPaused {
        Shipment storage s = shipments[_shipmentId];
        require(s.exists, "No shipment");
        require(s.status == ShipmentStatus.Created, "Transit started");
        require(msg.sender == s.buyer || hasRole(ADMIN_ROLE, msg.sender), "Unauthorized");

        if (usycWrapped[_shipmentId]) {
            _redeemUSYC(_shipmentId);
        }

        s.status = ShipmentStatus.Cancelled;

        uint256 refundAmount = s.cargoValue + s.shippingFee;
        
        if (shipmentHasPOLoan[_shipmentId]) {
            POLoan memory po = poLoans[shipmentPOLoans[_shipmentId]];
            refundAmount = refundAmount - po.repaymentAmount;
        }

        require(
            IERC20(s.token).transfer(s.buyer, refundAmount),
            "Refund failed"
        );

        IFreightPassport(passportContract).updatePassport(
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
        require(s.exists, "No shipment");
        require(s.status == ShipmentStatus.Completed, "Not completed");
        require(msg.sender == s.carrier, "Only carrier");
        require(_crew.length == _amounts.length, "Len mismatch");
        require(_crew.length > 0 && _crew.length <= 50, "Crew size must be between 1 and 50");

        uint256 totalPayout = 0;
        for (uint256 i = 0; i < _amounts.length; i++) {
            totalPayout += _amounts[i];
        }

        require(IERC20(s.token).balanceOf(msg.sender) >= totalPayout, "Low balance");

        for (uint256 i = 0; i < _crew.length; i++) {
            require(
                IERC20(s.token).transferFrom(msg.sender, _crew[i], _amounts[i]),
                "Payment failed"
            );
        }

        emit CarrierPayrollPaid(_shipmentId, msg.sender, totalPayout, _crew.length);
    }

    function offerShipmentForFactoring(uint256 _shipmentId, uint256 _price) external whenNotPaused {
        Shipment memory s = shipments[_shipmentId];
        require(s.exists, "Shipment does not exist");
        require(msg.sender == s.supplier, "Only supplier can offer factoring");
        require(s.status == ShipmentStatus.Created || s.status == ShipmentStatus.InTransit, "Invalid shipment status for factoring");
        require(shipmentBeneficiary[_shipmentId] == s.supplier, "Shipment already factored");
        require(_price > 0 && _price < s.cargoValue, "Invalid factoring price");

        factoringOffers[_shipmentId] = FactoringOffer({
            price: _price,
            active: true,
            investor: address(0)
        });

        emit FactoringOffered(_shipmentId, msg.sender, _price);
    }

    function cancelFactoringOffer(uint256 _shipmentId) external whenNotPaused {
        Shipment memory s = shipments[_shipmentId];
        require(s.exists, "Shipment does not exist");
        require(msg.sender == s.supplier, "Only supplier can cancel factoring");
        require(factoringOffers[_shipmentId].active, "No active factoring offer");

        factoringOffers[_shipmentId].active = false;

        emit FactoringCancelled(_shipmentId, msg.sender);
    }

    function purchaseFactoredShipment(uint256 _shipmentId) external nonReentrant whenNotPaused {
        Shipment memory s = shipments[_shipmentId];
        require(s.exists, "Shipment does not exist");
        FactoringOffer storage offer = factoringOffers[_shipmentId];
        require(offer.active, "No active factoring offer");
        require(msg.sender != s.supplier, "Supplier cannot purchase own factoring");

        offer.active = false;
        offer.investor = msg.sender;
        shipmentBeneficiary[_shipmentId] = msg.sender;

        require(
            IERC20(s.token).transferFrom(msg.sender, s.supplier, offer.price),
            "Factoring payment to supplier failed"
        );

        emit FactoringPurchased(_shipmentId, s.supplier, msg.sender, offer.price);
    }

    function requestPOFinancing(
        address _buyer,
        uint256 _cargoValue,
        uint256 _loanAmount,
        address _token
    ) external whenNotPaused returns (uint256) {
        require(_buyer != address(0), "Invalid buyer address");
        require(_cargoValue >= MIN_ESCROW_VALUE, "Escrow below minimum value");
        require(_loanAmount > 0 && _loanAmount <= (_cargoValue * 80) / 100, "Loan limit is 80% of cargo value");
        require(_loanAmount <= MAX_PO_LOAN_CAP, "Loan requested exceeds cap");
        require(_token == usdcToken || _token == eurcToken, "Only USDC/EURC supported");

        uint256 poId = nextPOId++;
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
        require(po.supplier != address(0), "PO does not exist");
        require(!po.funded, "PO already funded");
        require(msg.sender != po.supplier, "Supplier cannot fund own PO");

        po.funded = true;
        po.investor = msg.sender;

        require(
            IERC20(po.token).transferFrom(msg.sender, po.supplier, po.loanRequested),
            "Funding transfer failed"
        );

        emit POFinancingFunded(_poId, msg.sender, po.loanRequested);
    }

    function triggerMilestoneWithIoTSignature(
        uint256 _shipmentId,
        string calldata _milestoneType,
        int256 _temperature,
        uint256 _humidity,
        uint256 _timestamp,
        bytes calldata _signature
    ) external nonReentrant whenNotPaused {
        Shipment storage s = shipments[_shipmentId];
        require(s.exists, "Shipment does not exist");
        address gateway = iotGateway[_shipmentId];
        require(gateway != address(0), "No IoT gateway registered for this shipment");

        bytes32 messageHash = keccak256(abi.encodePacked(
            _shipmentId,
            _milestoneType,
            _temperature,
            _humidity,
            _timestamp
        ));
        bytes32 ethSignedHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            messageHash
        ));

        require(_signature.length == 65, "Invalid signature length");
        bytes32 r;
        bytes32 sv;
        uint8 v;
        assembly {
            r := calldataload(_signature.offset)
            sv := calldataload(add(_signature.offset, 32))
            v := byte(0, calldataload(add(_signature.offset, 64)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "Invalid signature v value");

        address recovered = ecrecover(ethSignedHash, v, r, sv);
        require(recovered == gateway, "IoT signature verification failed: signer mismatch");

        emit IoTSignatureVerified(_shipmentId, recovered, _milestoneType, _temperature, _humidity);

        humidityData[_shipmentId] = _humidity;

        bytes32 milestoneHash = keccak256(bytes(_milestoneType));

        if (milestoneHash == keccak256("departure")) {
            require(s.status == ShipmentStatus.Created, "Invalid status for departure");
            if (cctpFundingRequired[_shipmentId]) {
                require(cctpSourceTxHash[_shipmentId] != bytes32(0), "Shipment not funded yet via CCTP");
            }
            
            _checkTemperature(_shipmentId, _temperature, s.departurePort);
            
            s.status = ShipmentStatus.InTransit;
            IFreightPassport(passportContract).updatePassport(s.passportTokenId, "In Transit (IoT Verified)", s.departurePort, _temperature, false);
            emit MilestoneReached(_shipmentId, "IoT Departure", s.departurePort, _temperature, 0);
        } else if (milestoneHash == keccak256("singapore")) {
            require(s.status == ShipmentStatus.InTransit, "Invalid status");
            require(!singaporeMilestonePaid[_shipmentId], "Singapore already paid");
            require(!shipmentHasPOLoan[_shipmentId], "Singapore payout disabled for PO financed");
            
            _checkTemperature(_shipmentId, _temperature, "Singapore Port");
            
            singaporeMilestonePaid[_shipmentId] = true;
            uint256 payout = (s.cargoValue * 30) / 100;
            s.releasedSupplierAmount += payout;
            
            address beneficiary = shipmentBeneficiary[_shipmentId];
            if (beneficiary == address(0)) beneficiary = s.supplier;
            require(IERC20(s.token).transfer(beneficiary, payout), "Milestone payout failed");
            IFreightPassport(passportContract).updatePassport(s.passportTokenId, "Singapore (IoT Verified, 30% Payout)", "Singapore Port", _temperature, false);
            emit MilestoneReached(_shipmentId, "IoT Singapore Checkpoint", "Singapore Port", _temperature, payout);
        } else if (milestoneHash == keccak256("arrival")) {
            require(s.status == ShipmentStatus.InTransit, "Invalid status");
            
            _checkTemperature(_shipmentId, _temperature, s.destinationPort);
            
            s.status = ShipmentStatus.Arrived;
            s.arrivedTimestamp = block.timestamp;
            IFreightPassport(passportContract).updatePassport(s.passportTokenId, "Arrived (IoT Verified)", s.destinationPort, _temperature, false);
            emit MilestoneReached(_shipmentId, "IoT Arrival", s.destinationPort, _temperature, 0);
        } else if (milestoneHash == keccak256("customs")) {
            require(s.status == ShipmentStatus.Arrived, "Invalid status");
            
            _checkTemperature(_shipmentId, _temperature, s.destinationPort);
            
            s.status = ShipmentStatus.CustomCleared;
            s.customClearanceTimestamp = block.timestamp;
            IFreightPassport(passportContract).updatePassport(s.passportTokenId, "Customs Cleared (IoT Verified)", s.destinationPort, _temperature, false);
            emit MilestoneReached(_shipmentId, "IoT Customs", s.destinationPort, _temperature, 0);
        } else {
            revert("Unknown milestone type");
        }
    }

    function wrapEscrowInUSYC(uint256 _shipmentId) external onlyOperator nonReentrant whenNotPaused {
        Shipment memory s = shipments[_shipmentId];
        require(s.exists, "Shipment does not exist");
        require(s.status == ShipmentStatus.Created, "Can only wrap before transit");
        require(usycVault != address(0), "USYC vault not configured");
        require(!usycWrapped[_shipmentId], "Already wrapped");

        uint256 escrowBalance = s.cargoValue + s.shippingFee - s.releasedSupplierAmount;
        require(escrowBalance > 0, "No funds to wrap");

        (bool approveSuccess,) = s.token.call(
            abi.encodeWithSignature("approve(address,uint256)", usycVault, escrowBalance)
        );
        require(approveSuccess, "USYC approve failed");

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
        require(usycWrapped[_shipmentId], "Not wrapped in USYC");
        require(usycShares[_shipmentId] > 0, "No shares to redeem");
        return _redeemUSYC(_shipmentId);
    }

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
        require(passportContract != address(0), "No passport");
        require(_supplier != address(0) && _carrier != address(0), "Bad addresses");
        require(_cargoValue >= MIN_ESCROW_VALUE, "Escrow below minimum value");
        require(_shippingFee > 0, "Bad shipping fee");
        require(_token == usdcToken || _token == eurcToken, "Bad token");

        uint256 shipmentId = nextShipmentId++;
        
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

        cctpFundingRequired[shipmentId] = true;

        emit ShipmentCreated(shipmentId, msg.sender, _supplier, _carrier, passportId, _token);
        return shipmentId;
    }

    function parseCCTPMessage(bytes calldata message) public pure returns (
        uint32 sourceDomain,
        uint256 amount,
        address mintRecipient
    ) {
        require(message.length >= 248, "Invalid CCTP message length");
        sourceDomain = uint32(bytes4(message[4:8]));
        amount = uint256(bytes32(message[184:216]));
        mintRecipient = address(uint160(uint256(bytes32(message[152:184]))));
    }

    function recordCCTPFunding(
        uint256 _shipmentId,
        bytes32 _sourceTxHash,
        bytes calldata _message
    ) external nonReentrant whenNotPaused {
        Shipment storage s = shipments[_shipmentId];
        require(s.exists, "Shipment does not exist");
        require(s.status == ShipmentStatus.Created, "Shipment already in transit or completed");

        (uint32 domain, uint256 amt, address recipient) = parseCCTPMessage(_message);
        require(recipient == s.buyer || recipient == address(this), "CCTP recipient must match shipment buyer or contract");

        uint256 totalEscrowNeeded = s.cargoValue + s.shippingFee;
        require(amt >= totalEscrowNeeded, "CCTP amount insufficient for escrow");

        uint64 nonce = uint64(bytes8(_message[12:20]));
        bytes32 sourceAndNonce = keccak256(abi.encodePacked(domain, nonce));

        require(
            IMessageTransmitter(MESSAGE_TRANSMITTER).usedNonces(sourceAndNonce) > 0,
            "CCTP message not processed on destination chain"
        );

        require(!processedCCTPNonces[sourceAndNonce], "CCTP message already used for escrow");
        processedCCTPNonces[sourceAndNonce] = true;

        cctpSourceTxHash[_shipmentId] = _sourceTxHash;
        cctpSourceDomain[_shipmentId] = domain;

        if (recipient == s.buyer) {
            require(
                IERC20(s.token).transferFrom(s.buyer, address(this), totalEscrowNeeded),
                "CCTP USDC transferFrom buyer failed"
            );
        }

        emit CCTPFundingReceived(_shipmentId, domain, _sourceTxHash, amt);
    }

    function getBuyerShipments(address _buyer) external view returns (uint256[] memory) {
        return _buyerShipments[_buyer];
    }

    function getSupplierShipments(address _supplier) external view returns (uint256[] memory) {
        return _supplierShipments[_supplier];
    }

    function getCarrierShipments(address _carrier) external view returns (uint256[] memory) {
        return _carrierShipments[_carrier];
    }

    function getIoTGateway(uint256 _shipmentId) external view returns (address) {
        return iotGateway[_shipmentId];
    }

    function getHumidity(uint256 _shipmentId) external view returns (uint256) {
        return humidityData[_shipmentId];
    }

    function getUSYCInfo(uint256 _shipmentId) external view returns (bool wrapped, uint256 shares, uint256 yield_) {
        return (usycWrapped[_shipmentId], usycShares[_shipmentId], yieldEarned[_shipmentId]);
    }

    function getCCTPInfo(uint256 _shipmentId) external view returns (uint32 sourceDomain, bytes32 sourceTxHash) {
        return (cctpSourceDomain[_shipmentId], cctpSourceTxHash[_shipmentId]);
    }
}
