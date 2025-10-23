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
 * @title EvorDelegateV2
 * @notice Stateless delegate for EIP-7702 - using direct calls instead of low-level call
 */
contract EvorDelegateV2 {
    error LengthMismatch();
    error ZeroAddress();

    function revokeERC20(address[] calldata tokens, address[] calldata spenders) external {
        uint256 n = tokens.length;
        if (n != spenders.length) revert LengthMismatch();
        
        for (uint256 i; i < n; ++i) {
            address t = tokens[i];
            address s = spenders[i];
            if (t == address(0) || s == address(0)) revert ZeroAddress();
            
            // Direct call - should preserve msg.sender
            IERC20(t).approve(s, 0);
        }
    }

    function revokeForAll(address[] calldata collections, address[] calldata operators) external {
        uint256 n = collections.length;
        if (n != operators.length) revert LengthMismatch();
        
        for (uint256 i; i < n; ++i) {
            address c = collections[i];
            address o = operators[i];
            if (c == address(0) || o == address(0)) revert ZeroAddress();
            
            IERC721(c).setApprovalForAll(o, false);
        }
    }
}
