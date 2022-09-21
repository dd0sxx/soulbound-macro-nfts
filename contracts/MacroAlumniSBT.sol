// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.15;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

import "solmate/src/tokens/ERC721.sol";

contract MacroAlumniSBT is ERC721 {


    uint256 nextTokenID;
    string baseTokenURI;
    address admin;

    constructor () ERC721("Macro Alumni Soulbound Token", "MASBT") {}

    modifier onlyAdmin {
        require(msg.sender == admin, "ADMIN_ONLY");
        _;
    }

    /// @notice Emitted when the locking status is changed to locked.
    /// @dev If a token is minted and the status is locked, this event should be emitted.
    /// @param tokenId The identifier for a token.
    event Locked(uint256 tokenId);

    /// @notice Emitted when the locking status is changed to unlocked.
    /// @dev If a token is minted and the status is unlocked, this event should be emitted.
    /// @param tokenId The identifier for a token.
    event Unlocked(uint256 tokenId);

    function mint (address to) external {
        require(balanceOf(msg.sender) == 0, "BALANCE_NON_ZERO");
        _mint(msg.sender, nextTokenID);
        emit Locked(nextTokenID);
        unchecked {
            nextTokenID++;
        }
    }

    function burn (uint256 tokenId) external onlyAdmin {
        _burn(tokenId);
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        return "";
    }

    function setBaseURI (string calldata _baseURI) external onlyAdmin {
        baseTokenURI = _baseURI;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == 0xb45a3c0e || super.supportsInterface(interfaceId);
    }

    /// @notice Returns the locking status of an Soulbound Token
    /// @dev SBTs assigned to zero address are considered invalid, and queries
    /// about them do throw.
    /// @param tokenId The identifier for an SBT.
    function locked(uint256 tokenId) external view returns (bool) {
        return true;
    }

}