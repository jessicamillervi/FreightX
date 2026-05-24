// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC721Receiver {
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);
}

contract FreightPassport {
    string public name = "FreightX Cargo Passport";
    string public symbol = "FRTX-PASS";

    struct CargoMetadata {
        string departurePort;
        string destinationPort;
        string currentStatus;
        string lastLocation;
        int256 lastTemperature; // in Celsius (multiplied by 100, e.g. 450 = 4.5°C)
        uint256 createdTimestamp;
        uint256 lastUpdatedTimestamp;
        bool isCompleted;
    }

    uint256 private _nextTokenId;
    address public escrowContract;

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => CargoMetadata) private _metadata;
    mapping(uint256 => string[]) private _locationHistory;
    mapping(uint256 => int256[]) private _temperatureHistory;
    mapping(uint256 => uint256[]) private _updateTimeline;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event PassportUpdated(uint256 indexed tokenId, string status, string location, int256 temperature);

    modifier onlyEscrow() {
        require(msg.sender == escrowContract, "Only FreightEscrow contract can call this");
        _;
    }

    constructor() {
        escrowContract = msg.sender;
    }

    function setEscrowContract(address _escrow) external {
        require(msg.sender == escrowContract, "Only current owner/escrow can update");
        escrowContract = _escrow;
    }

    function mint(
        address to,
        string calldata departure,
        string calldata destination
    ) external onlyEscrow returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        
        _owners[tokenId] = to;
        _balances[to] += 1;

        _metadata[tokenId] = CargoMetadata({
            departurePort: departure,
            destinationPort: destination,
            currentStatus: "Created",
            lastLocation: departure,
            lastTemperature: 1500, // 15.0°C default
            createdTimestamp: block.timestamp,
            lastUpdatedTimestamp: block.timestamp,
            isCompleted: false
        });

        _locationHistory[tokenId].push(departure);
        _temperatureHistory[tokenId].push(1500);
        _updateTimeline[tokenId].push(block.timestamp);

        emit Transfer(address(0), to, tokenId);
        emit PassportUpdated(tokenId, "Created", departure, 1500);

        return tokenId;
    }

    function updatePassport(
        uint256 tokenId,
        string calldata status,
        string calldata location,
        int256 temperature,
        bool completed
    ) external onlyEscrow {
        require(_owners[tokenId] != address(0), "Passport does not exist");
        
        CargoMetadata storage meta = _metadata[tokenId];
        meta.currentStatus = status;
        meta.lastLocation = location;
        meta.lastTemperature = temperature;
        meta.lastUpdatedTimestamp = block.timestamp;
        meta.isCompleted = completed;

        _locationHistory[tokenId].push(location);
        _temperatureHistory[tokenId].push(temperature);
        _updateTimeline[tokenId].push(block.timestamp);

        emit PassportUpdated(tokenId, status, location, temperature);
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "Token does not exist");
        return owner;
    }

    function balanceOf(address owner) external view returns (uint256) {
        require(owner != address(0), "Zero address query");
        return _balances[owner];
    }

    function getMetadata(uint256 tokenId) external view returns (CargoMetadata memory) {
        require(_owners[tokenId] != address(0), "Token does not exist");
        return _metadata[tokenId];
    }

    function getHistory(uint256 tokenId) external view returns (
        string[] memory locations,
        int256[] memory temperatures,
        uint256[] memory timeline
    ) {
        require(_owners[tokenId] != address(0), "Token does not exist");
        return (
            _locationHistory[tokenId],
            _temperatureHistory[tokenId],
            _updateTimeline[tokenId]
        );
    }
}
