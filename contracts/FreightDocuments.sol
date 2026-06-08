// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract FreightDocuments is ERC721, AccessControl, Pausable {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    struct DocumentMetadata {
        string ipfsHash;
        uint256 passportTokenId;
        string shipper;
        string consignee;
        string cargoDescription;
        uint256 weightKg;
        string containerNumber;
        uint256 timestamp;
        uint256 version;
    }

    uint256 private _nextTokenId;
    
    // Mapping from document tokenId to version history
    mapping(uint256 => DocumentMetadata[]) private _documentHistory;

    event DocumentMinted(uint256 indexed tokenId, address indexed to, uint256 indexed passportTokenId, string ipfsHash);
    event DocumentAmended(uint256 indexed tokenId, uint256 indexed version, string ipfsHash, uint256 timestamp);

    constructor() ERC721("FreightX Cargo Document", "FRTX-DOC") {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        _setupRole(OPERATOR_ROLE, msg.sender);
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function mintDocument(
        address to,
        string calldata ipfsHash,
        uint256 passportTokenId,
        string calldata shipper,
        string calldata consignee,
        string calldata cargoDescription,
        uint256 weightKg,
        string calldata containerNumber
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _mint(to, tokenId);

        _documentHistory[tokenId].push(DocumentMetadata({
            ipfsHash: ipfsHash,
            passportTokenId: passportTokenId,
            shipper: shipper,
            consignee: consignee,
            cargoDescription: cargoDescription,
            weightKg: weightKg,
            containerNumber: containerNumber,
            timestamp: block.timestamp,
            version: 1
        }));

        emit DocumentMinted(tokenId, to, passportTokenId, ipfsHash);
        return tokenId;
    }

    function amendDocument(
        uint256 tokenId,
        string calldata ipfsHash,
        string calldata shipper,
        string calldata consignee,
        string calldata cargoDescription,
        uint256 weightKg,
        string calldata containerNumber
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        require(_exists(tokenId), "Document does not exist");
        
        uint256 currentHistoryLength = _documentHistory[tokenId].length;
        uint256 parentPassportTokenId = _documentHistory[tokenId][0].passportTokenId;
        uint256 nextVersion = currentHistoryLength + 1;

        _documentHistory[tokenId].push(DocumentMetadata({
            ipfsHash: ipfsHash,
            passportTokenId: parentPassportTokenId,
            shipper: shipper,
            consignee: consignee,
            cargoDescription: cargoDescription,
            weightKg: weightKg,
            containerNumber: containerNumber,
            timestamp: block.timestamp,
            version: nextVersion
        }));

        emit DocumentAmended(tokenId, nextVersion, ipfsHash, block.timestamp);
    }

    function getDocumentHistory(uint256 tokenId) external view returns (DocumentMetadata[] memory) {
        require(_exists(tokenId), "Document does not exist");
        return _documentHistory[tokenId];
    }

    function getLatestDocument(uint256 tokenId) external view returns (DocumentMetadata memory) {
        require(_exists(tokenId), "Document does not exist");
        uint256 lastIdx = _documentHistory[tokenId].length - 1;
        return _documentHistory[tokenId][lastIdx];
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
