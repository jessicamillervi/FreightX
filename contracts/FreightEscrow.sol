// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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

contract FreightEscrow {
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

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyOracle() {
        // In a production app, this would check if msg.sender is a registered Oracle or IoT Gateway.
        // For our hackathon prototype, the owner acts as the Oracle.
        require(msg.sender == owner, "Only Oracle/Owner");
        _;
    }

    constructor(address _usdcToken, address _eurcToken) {
        owner = msg.sender;
        usdcToken = _usdcToken;
        eurcToken = _eurcToken;
    }

    function setPassportContract(address _passport) external onlyOwner {
        passportContract = _passport;
    }

    function setUsycVault(address _vault) external onlyOwner {
        usycVault = _vault;
    }

    // Register IoT Gateway Device for a shipment
    function setIotGateway(uint256 _shipmentId, address _gateway) external {
        Shipment memory s = shipments[_shipmentId];
        require(s.exists, "Shipment does not exist");
        require(msg.sender == s.buyer || msg.sender == owner, "Only buyer/owner");
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
    ) external returns (uint256) {
        require(passportContract != address(0), "No passport");
        require(_supplier != address(0) && _carrier != address(0), "Bad addresses");
        require(_cargoValue > 0 && _shippingFee > 0, "Bad amounts");
        require(_token == usdcToken || _token == eurcToken, "Bad token");

        uint256 totalEscrowNeeded = _cargoValue + _shippingFee;
        
        // Transfer USDC/EURC from buyer to this contract
        require(
            IERC20(_token).transferFrom(msg.sender, address(this), totalEscrowNeeded),
            "Deposit failed"
        );

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
            require(po.buyer == msg.sender, "PO buyer mismatch");
            require(po.supplier == _supplier, "PO supplier mismatch");
            require(po.cargoValue == _cargoValue, "PO cargo mismatch");
            require(po.token == _token, "PO token mismatch");
            require(po.funded, "PO not funded");
            require(!po.repaid, "PO repaid");

            po.repaid = true;
            shipmentPOLoans[shipmentId] = _poId;
            shipmentHasPOLoan[shipmentId] = true;
            
            // Repay investor loan immediately
            require(
                IERC20(_token).transfer(po.investor, po.repaymentAmount),
                "PO repayment failed"
            );
            
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

    function triggerMilestoneDeparture(uint256 _shipmentId, int256 _temp) external onlyOracle {
        Shipment storage s = shipments[_shipmentId];
        require(s.exists, "No shipment");
        require(s.status == ShipmentStatus.Created, "Bad status");

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

    function triggerMilestoneSingapore(uint256 _shipmentId, int256 _temp) external onlyOracle {
        Shipment storage s = shipments[_shipmentId];
        require(s.exists, "No shipment");
        require(s.status == ShipmentStatus.InTransit, "Bad status");
        require(!singaporeMilestonePaid[_shipmentId], "Already paid");
        require(!shipmentHasPOLoan[_shipmentId], "PO financed");

        singaporeMilestonePaid[_shipmentId] = true;

        // Release 30% of cargo value to the beneficiary as a milestone payout
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

    function triggerMilestoneArrived(uint256 _shipmentId, int256 _temp) external onlyOracle {
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

    function triggerCustomClearance(uint256 _shipmentId, int256 _temp) external onlyOracle {
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
            // Round up to the nearest hour
            hoursLate = (lateSeconds + 3599) / 3600;
            penaltyAmount = hoursLate * s.demurrageRatePerHour;
        } else {
            hoursLate = 0;
            penaltyAmount = 0;
        }
    }

    function pickupCargo(uint256 _shipmentId) external {
        Shipment storage s = shipments[_shipmentId];
        require(s.exists, "No shipment");
        require(s.status == ShipmentStatus.CustomCleared, "Not cleared");
        require(msg.sender == s.buyer, "Only buyer");

        // Auto-redeem USYC if wrapped
        if (usycWrapped[_shipmentId]) {
            _redeemUSYC(_shipmentId);
        }

        s.pickupTimestamp = block.timestamp;
        s.status = ShipmentStatus.Completed;

        (uint256 hoursLate, uint256 penaltyAmount) = getDemurragePenalty(_shipmentId);

        if (penaltyAmount > 0) {
            s.demurragePenaltyPaid = penaltyAmount;
            // Transfer demurrage penalty from buyer to the carrier
            require(
                IERC20(s.token).transferFrom(msg.sender, s.carrier, penaltyAmount),
                "Demurrage failed"
            );
            emit DemurrageCharged(_shipmentId, hoursLate, penaltyAmount);
        }

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
        s.releasedSupplierAmount += finalSupplierPayout;

        // Payout carrier (shippingFee minus platform fee share)
        uint256 carrierPlatformFee = (s.shippingFee * 25) / 10000;
        uint256 finalCarrierPayout = s.shippingFee - carrierPlatformFee;
        s.releasedCarrierAmount = finalCarrierPayout;

        address beneficiary = shipmentBeneficiary[_shipmentId];
        if (beneficiary == address(0)) {
            beneficiary = s.supplier;
        }

        // Perform transfers
        if (tempPenalty > 0) {
            temperaturePenalties[_shipmentId] = tempPenalty;
            // Refund penalty to buyer
            require(
                IERC20(s.token).transfer(s.buyer, tempPenalty),
                "Refund failed"
            );
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

        // Calculate and pay USYC Yield Rebate (real or simulated)
        uint256 realYield = yieldEarned[_shipmentId];
        if (realYield > 0) {
            // Already redeemed real yield, transfer it to buyer
            require(
                IERC20(s.token).transfer(s.buyer, realYield),
                "Transfer failed"
            );
        } else {
            // Check for simulated yield fallback if not wrapped
            uint256 createdTime = createdTimestamps[_shipmentId];
            if (createdTime > 0) {
                uint256 elapsed = block.timestamp - createdTime;
                uint256 escrowedAmount = s.cargoValue + s.shippingFee;
                uint256 simulatedYield = (escrowedAmount * USYC_APY_BPS * elapsed) / (10000 * 365 days);
                
                if (simulatedYield > 0) {
                    uint256 contractBal = IERC20(s.token).balanceOf(address(this));
                    uint256 totalFinalPayouts = finalPayoutAfterPenalty + finalCarrierPayout + platformFee;
                    if (contractBal >= totalFinalPayouts + simulatedYield) {
                        IERC20(s.token).transfer(s.buyer, simulatedYield);
                        yieldEarned[_shipmentId] = simulatedYield;
                    }
                }
            }
        }

        // Update Cargo Passport to Completed
        IFreightPassport(passportContract).updatePassport(
            s.passportTokenId,
            "Cargo Delivered & Payments Settled",
            s.destinationPort,
            1200, // standard room temperature
            true
        );

        emit ShipmentCompleted(_shipmentId, finalPayoutAfterPenalty, finalCarrierPayout, platformFee);
    }

    function cancelShipment(uint256 _shipmentId) external {
        Shipment storage s = shipments[_shipmentId];
        require(s.exists, "No shipment");
        require(s.status == ShipmentStatus.Created, "Transit started");
        require(msg.sender == s.buyer || msg.sender == owner, "Unauthorized");

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
    ) external {
        Shipment memory s = shipments[_shipmentId];
        require(s.exists, "No shipment");
        require(s.status == ShipmentStatus.Completed, "Not completed");
        require(msg.sender == s.carrier, "Only carrier");
        require(_crew.length == _amounts.length, "Len mismatch");

        uint256 totalPayout = 0;
        for (uint256 i = 0; i < _amounts.length; i++) {
            totalPayout += _amounts[i];
        }

        // Verify the carrier has enough balance
        require(IERC20(s.token).balanceOf(msg.sender) >= totalPayout, "Low balance");

        // Distribute funds
        for (uint256 i = 0; i < _crew.length; i++) {
            require(
                IERC20(s.token).transferFrom(msg.sender, _crew[i], _amounts[i]),
                "Payment failed"
            );
        }

        emit CarrierPayrollPaid(_shipmentId, msg.sender, totalPayout, _crew.length);
    }

    // Help functions for UI querying
    function getBuyerShipments(address _buyer) external view returns (uint256[] memory) {
        return _buyerShipments[_buyer];
    }

    function getSupplierShipments(address _supplier) external view returns (uint256[] memory) {
        return _supplierShipments[_supplier];
    }

    function getCarrierShipments(address _carrier) external view returns (uint256[] memory) {
        return _carrierShipments[_carrier];
    }

    // Advanced features functions: Factoring
    function offerShipmentForFactoring(uint256 _shipmentId, uint256 _price) external {
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

    function cancelFactoringOffer(uint256 _shipmentId) external {
        Shipment memory s = shipments[_shipmentId];
        require(s.exists, "Shipment does not exist");
        require(msg.sender == s.supplier, "Only supplier can cancel factoring");
        require(factoringOffers[_shipmentId].active, "No active factoring offer");

        factoringOffers[_shipmentId].active = false;

        emit FactoringCancelled(_shipmentId, msg.sender);
    }

    function purchaseFactoredShipment(uint256 _shipmentId) external {
        Shipment memory s = shipments[_shipmentId];
        require(s.exists, "Shipment does not exist");
        FactoringOffer storage offer = factoringOffers[_shipmentId];
        require(offer.active, "No active factoring offer");
        require(msg.sender != s.supplier, "Supplier cannot purchase own factoring");

        offer.active = false;
        offer.investor = msg.sender;
        shipmentBeneficiary[_shipmentId] = msg.sender;

        // Transfer price in USDC/EURC from investor to supplier
        require(
            IERC20(s.token).transferFrom(msg.sender, s.supplier, offer.price),
            "Factoring payment to supplier failed"
        );

        emit FactoringPurchased(_shipmentId, s.supplier, msg.sender, offer.price);
    }

    // Advanced features functions: PO Financing
    function requestPOFinancing(
        address _buyer,
        uint256 _cargoValue,
        uint256 _loanAmount,
        address _token
    ) external returns (uint256) {
        require(_buyer != address(0), "Invalid buyer address");
        require(_loanAmount > 0 && _loanAmount <= (_cargoValue * 80) / 100, "Loan limit is 80% of cargo value");
        require(_token == usdcToken || _token == eurcToken, "Only USDC/EURC supported");

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

    function fundPOLoan(uint256 _poId) external {
        POLoan storage po = poLoans[_poId];
        require(po.supplier != address(0), "PO does not exist");
        require(!po.funded, "PO already funded");
        require(msg.sender != po.supplier, "Supplier cannot fund own PO");

        po.funded = true;
        po.investor = msg.sender;

        // Transfer principal from investor to supplier
        require(
            IERC20(po.token).transferFrom(msg.sender, po.supplier, po.loanRequested),
            "Funding transfer failed"
        );

        emit POFinancingFunded(_poId, msg.sender, po.loanRequested);
    }

    // ─── IoT Cryptographic Signature Verification ───

    function triggerMilestoneWithIoTSignature(
        uint256 _shipmentId,
        string calldata _milestoneType, // "departure", "singapore", "arrival", "customs"
        int256 _temperature,
        uint256 _humidity,
        uint256 _timestamp,
        bytes calldata _signature
    ) external {
        Shipment storage s = shipments[_shipmentId];
        require(s.exists, "Shipment does not exist");
        address gateway = iotGateway[_shipmentId];
        require(gateway != address(0), "No IoT gateway registered for this shipment");

        // Reconstruct the message hash the IoT device signed
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

        // Recover signer from ECDSA signature
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

        // Store humidity data
        humidityData[_shipmentId] = _humidity;

        // Check temperature SLA
        _checkTemperature(_shipmentId, _temperature, s.departurePort);

        // Route to appropriate milestone logic
        bytes32 milestoneHash = keccak256(bytes(_milestoneType));

        if (milestoneHash == keccak256("departure")) {
            require(s.status == ShipmentStatus.Created, "Invalid status for departure");
            s.status = ShipmentStatus.InTransit;
            IFreightPassport(passportContract).updatePassport(s.passportTokenId, "In Transit (IoT Verified)", s.departurePort, _temperature, false);
            emit MilestoneReached(_shipmentId, "IoT Departure", s.departurePort, _temperature, 0);
        } else if (milestoneHash == keccak256("singapore")) {
            require(s.status == ShipmentStatus.InTransit, "Invalid status");
            require(!singaporeMilestonePaid[_shipmentId], "Singapore already paid");
            require(!shipmentHasPOLoan[_shipmentId], "Singapore payout disabled for PO financed");
            singaporeMilestonePaid[_shipmentId] = true;
            uint256 payout = (s.cargoValue * 30) / 100;
            s.releasedSupplierAmount += payout;
            _checkTemperature(_shipmentId, _temperature, "Singapore Port");
            address beneficiary = shipmentBeneficiary[_shipmentId];
            if (beneficiary == address(0)) beneficiary = s.supplier;
            require(IERC20(s.token).transfer(beneficiary, payout), "Milestone payout failed");
            IFreightPassport(passportContract).updatePassport(s.passportTokenId, "Singapore (IoT Verified, 30% Payout)", "Singapore Port", _temperature, false);
            emit MilestoneReached(_shipmentId, "IoT Singapore Checkpoint", "Singapore Port", _temperature, payout);
        } else if (milestoneHash == keccak256("arrival")) {
            require(s.status == ShipmentStatus.InTransit, "Invalid status");
            s.status = ShipmentStatus.Arrived;
            s.arrivedTimestamp = block.timestamp;
            _checkTemperature(_shipmentId, _temperature, s.destinationPort);
            IFreightPassport(passportContract).updatePassport(s.passportTokenId, "Arrived (IoT Verified)", s.destinationPort, _temperature, false);
            emit MilestoneReached(_shipmentId, "IoT Arrival", s.destinationPort, _temperature, 0);
        } else if (milestoneHash == keccak256("customs")) {
            require(s.status == ShipmentStatus.Arrived, "Invalid status");
            s.status = ShipmentStatus.CustomCleared;
            s.customClearanceTimestamp = block.timestamp;
            _checkTemperature(_shipmentId, _temperature, s.destinationPort);
            IFreightPassport(passportContract).updatePassport(s.passportTokenId, "Customs Cleared (IoT Verified)", s.destinationPort, _temperature, false);
            emit MilestoneReached(_shipmentId, "IoT Customs", s.destinationPort, _temperature, 0);
        } else {
            revert("Unknown milestone type");
        }
    }

    // ─── USYC Yield-Bearing Vault Wrapping ───

    function wrapEscrowInUSYC(uint256 _shipmentId) external onlyOwner {
        Shipment memory s = shipments[_shipmentId];
        require(s.exists, "Shipment does not exist");
        require(s.status == ShipmentStatus.Created, "Can only wrap before transit");
        require(usycVault != address(0), "USYC vault not configured");
        require(!usycWrapped[_shipmentId], "Already wrapped");

        uint256 escrowBalance = s.cargoValue + s.shippingFee - s.releasedSupplierAmount;
        require(escrowBalance > 0, "No funds to wrap");

        // Approve USYC vault to pull USDC
        IERC20(s.token).transfer(address(this), 0); // no-op to ensure we hold the tokens
        // We need to approve the vault contract
        // Using low-level call since IERC20 only has transfer/transferFrom
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

    function redeemUSYCForShipment(uint256 _shipmentId) external onlyOwner returns (uint256 assetsReturned) {
        require(usycWrapped[_shipmentId], "Not wrapped in USYC");
        require(usycShares[_shipmentId] > 0, "No shares to redeem");
        return _redeemUSYC(_shipmentId);
    }

    // ─── CCTP Cross-Chain Bridge Receiver ───

    function recordCCTPFunding(
        uint256 _shipmentId,
        uint32 _sourceDomain,
        bytes32 _sourceTxHash,
        uint256 _amount
    ) external onlyOwner {
        Shipment memory s = shipments[_shipmentId];
        require(s.exists, "Shipment does not exist");

        cctpSourceTxHash[_shipmentId] = _sourceTxHash;
        cctpSourceDomain[_shipmentId] = _sourceDomain;

        emit CCTPFundingReceived(_shipmentId, _sourceDomain, _sourceTxHash, _amount);
    }

    // View helpers for new features
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
