// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.15;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

import "solmate/src/tokens/ERC721.sol";

contract MacroAlumniSBT is ERC721 {

    constructor () ERC721("Macro Alumni Soulbound Token", "MASBT") {}

    function mint (address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }

    function burn (uint256 tokenId) external {
        _burn(tokenId);
    }

    function tokenURI(uint256 id) public pure override returns (string memory) {
        return "";
    }

}