// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 { 
    function approve(address spender, uint256 amount) external returns (bool); 
}

interface IERC721 { 
    function setApprovalForAll(address operator, bool approved) external; 
}

interface IERC1155 { 
    function setApprovalForAll(address operator, bool approved) external; 
}

/**
 * @title EvorDelegate
 * @notice Stateless delegate contract for EIP-7702 batch approval revocations
 * @dev Designed to be delegated to an EOA via EIP-7702 authorization
 */
contract EvorDelegate {
    error LengthMismatch();
    error ZeroAddress();

    /**
     * @notice Revoke ERC20 approvals in batch
     * @param tokens Array of ERC20 token addresses
     * @param spenders Array of spender addresses to revoke
     */
    function revokeERC20(address[] calldata tokens, address[] calldata spenders) external {
        uint256 n = tokens.length;
        if (n != spenders.length) revert LengthMismatch();
        
        for (uint256 i; i < n; ++i) {
            address t = tokens[i];
            address s = spenders[i];
            if (t == address(0) || s == address(0)) revert ZeroAddress();
            
            // Best effort: tolerate non-standard tokens
            (bool ok,) = t.call(abi.encodeWithSignature("approve(address,uint256)", s, 0));
            ok; // Silence unused variable warning
        }
    }

    /**
     * @notice Revoke ERC721/ERC1155 operator approvals in batch
     * @dev Works for both ERC721 and ERC1155 as they share the same setApprovalForAll signature
     * @param collections Array of NFT collection addresses (ERC721 or ERC1155)
     * @param operators Array of operator addresses to revoke
     */
    function revokeForAll(address[] calldata collections, address[] calldata operators) external {
        uint256 n = collections.length;
        if (n != operators.length) revert LengthMismatch();
        
        for (uint256 i; i < n; ++i) {
            address c = collections[i];
            address o = operators[i];
            if (c == address(0) || o == address(0)) revert ZeroAddress();
            
            (bool ok,) = c.call(abi.encodeWithSignature("setApprovalForAll(address,bool)", o, false));
            ok;
        }
    }
}
