// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

interface IFreightEscrow {
    function triggerMilestoneDeparture(uint256 _shipmentId, int256 _temp) external;
    function triggerMilestoneSingapore(uint256 _shipmentId, int256 _temp) external;
    function triggerMilestoneArrived(uint256 _shipmentId, int256 _temp) external;
    function triggerCustomClearance(uint256 _shipmentId, int256 _temp) external;
}

contract FreightOracle is AccessControl, Pausable {
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    address public escrowContract;
    mapping(uint256 => address) public deviceRegistry; // shipmentId => device address

    event DeviceRegistered(uint256 indexed shipmentId, address indexed deviceAddress);
    event TelemetryRelayed(uint256 indexed shipmentId, string milestoneType, int256 temperature, uint256 humidity);

    constructor(address _escrowContract) {
        escrowContract = _escrowContract;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(RELAYER_ROLE, msg.sender);
    }

    function setEscrowContract(address _escrowContract) external onlyRole(DEFAULT_ADMIN_ROLE) {
        escrowContract = _escrowContract;
    }

    function registerDevice(uint256 shipmentId, address deviceAddress) external onlyRole(DEFAULT_ADMIN_ROLE) whenNotPaused {
        require(deviceAddress != address(0), "Invalid device address");
        deviceRegistry[shipmentId] = deviceAddress;
        emit DeviceRegistered(shipmentId, deviceAddress);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function verifyAndRelay(
        uint256 _shipmentId,
        string calldata _milestoneType,
        int256 _temperature,
        uint256 _humidity,
        uint256 _timestamp,
        bytes calldata _signature
    ) external whenNotPaused {
        address device = deviceRegistry[_shipmentId];
        require(device != address(0), "No device registered for shipment");

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
        require(recovered == device, "Invalid device signature");

        // Relay call to FreightEscrow
        bytes32 milestoneHash = keccak256(bytes(_milestoneType));
        if (milestoneHash == keccak256("departure")) {
            IFreightEscrow(escrowContract).triggerMilestoneDeparture(_shipmentId, _temperature);
        } else if (milestoneHash == keccak256("singapore")) {
            IFreightEscrow(escrowContract).triggerMilestoneSingapore(_shipmentId, _temperature);
        } else if (milestoneHash == keccak256("arrival")) {
            IFreightEscrow(escrowContract).triggerMilestoneArrived(_shipmentId, _temperature);
        } else if (milestoneHash == keccak256("customs")) {
            IFreightEscrow(escrowContract).triggerCustomClearance(_shipmentId, _temperature);
        } else {
            revert("Invalid milestone type");
        }

        emit TelemetryRelayed(_shipmentId, _milestoneType, _temperature, _humidity);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
