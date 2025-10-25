// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title TestERC721
 * @notice Minimal ERC721 for testing approvals
 */
contract TestERC721 {
    string public name = "Test NFT";
    string public symbol = "TNFT";
    
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    
    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }
    
    function isApprovedForAll(address owner, address operator) external view returns (bool) {
        return _operatorApprovals[owner][operator];
    }
    
    // Mint function for testing (anyone can mint)
    function mint() external pure returns (uint256) {
        return 1; // Dummy - we only care about approvals
    }
}

/**
 * @title TestERC1155
 * @notice Minimal ERC1155 for testing approvals
 */
contract TestERC1155 {
    string public name = "Test Multi Token";
    string public symbol = "TMT";
    
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    
    event ApprovalForAll(address indexed account, address indexed operator, bool approved);
    
    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }
    
    function isApprovedForAll(address account, address operator) external view returns (bool) {
        return _operatorApprovals[account][operator];
    }
    
    // ERC165 supportsInterface - identifies this as ERC1155
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0xd9b67a26 || // ERC1155
               interfaceId == 0x01ffc9a7;   // ERC165
    }
    
    // Mint function for testing
    function mint(uint256 id, uint256 amount) external pure returns (bool) {
        id; amount; // Silence warnings
        return true; // Dummy - we only care about approvals
    }
}
