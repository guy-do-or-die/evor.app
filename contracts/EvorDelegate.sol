// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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
contract EvorDelegate is ReentrancyGuard {
    error LengthMismatch();
    error ZeroAddress();
    error BatchTooLarge();
    
    // Maximum batch size to stay within gas limits (30M block gas / ~103k per revoke)
    uint256 public constant MAX_BATCH_SIZE = 250;

    /**
     * @notice Revoke ERC20 approvals internally
     */
    function _revokeERC20(
        address[] calldata tokens,
        address[] calldata spenders
    ) internal {
        uint256 n = tokens.length;
        if (n != spenders.length) revert LengthMismatch();
        if (n > MAX_BATCH_SIZE) revert BatchTooLarge();
        
        for (uint256 i; i < n; ++i) {
            address t = tokens[i];
            address s = spenders[i];
            if (t == address(0) || s == address(0)) revert ZeroAddress();
            
            // Best effort: tolerate non-standard tokens
            // Gas limit prevents griefing, continue on failure
            (bool ok,) = t.call{gas: 100000}(abi.encodeWithSignature("approve(address,uint256)", s, 0));
            ok; // Silence unused variable warning
        }
    }

    /**
     * @notice Revoke NFT approvals internally
     */
    function _revokeForAll(
        address[] calldata collections,
        address[] calldata operators
    ) internal {
        uint256 n = collections.length;
        if (n != operators.length) revert LengthMismatch();
        if (n > MAX_BATCH_SIZE) revert BatchTooLarge();
        
        for (uint256 i; i < n; ++i) {
            address c = collections[i];
            address o = operators[i];
            if (c == address(0) || o == address(0)) revert ZeroAddress();
            
            // Gas limit prevents griefing, continue on failure
            (bool ok,) = c.call{gas: 100000}(abi.encodeWithSignature("setApprovalForAll(address,bool)", o, false));
            ok;
        }
    }

    /**
     * @notice Revoke ERC20 approvals
     * @param tokens Array of token addresses
     * @param spenders Array of spender addresses
     * @dev EIP-7702 note: payable removed - self-calls with value cause revert
     */
    function revokeERC20(
        address[] calldata tokens,
        address[] calldata spenders
    ) 
        external
        nonReentrant
    {
        _revokeERC20(tokens, spenders);
    }

    /**
     * @notice Revoke NFT approvals
     * @param collections Array of NFT collection addresses
     * @param operators Array of operator addresses
     * @dev EIP-7702 note: payable removed - self-calls with value cause revert
     */
    function revokeForAll(
        address[] calldata collections,
        address[] calldata operators
    ) 
        external
        nonReentrant
    {
        _revokeForAll(collections, operators);
    }

    /**
     * @notice Revoke both ERC20 and NFT approvals in one transaction
     * @param tokens Array of token addresses
     * @param spenders Array of spender addresses
     * @param collections Array of NFT collection addresses
     * @param operators Array of operator addresses
     * @dev EIP-7702 note: payable removed - self-calls with value cause revert
     */
    function revokeAll(
        address[] calldata tokens,
        address[] calldata spenders,
        address[] calldata collections,
        address[] calldata operators
    ) 
        external
        nonReentrant
    {
        _revokeERC20(tokens, spenders);
        _revokeForAll(collections, operators);
    }
}
