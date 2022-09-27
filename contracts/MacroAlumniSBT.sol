// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.15;

// Uncomment this line to use console.log
import "hardhat/console.sol";

import "solmate/src/tokens/ERC721.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

enum GraduationTiers { 
        HONORS,
        ENGINEERS,
        FOUNDERS,
        OG,
        ALUM
}

struct AlumniData {
        bool claimed;
        bool burned;
        uint16 blockNumber;
        GraduationTiers graduationTier;
}


contract MacroAlumniSBT is ERC721, Ownable {

    uint256 tokenSupply; // total # of tokens
    string baseTokenURI; // baseURI where the NFT metadata is located

    bytes32 public root; // merkle root 

    mapping (address => AlumniData) public addressToAlumniData;

    constructor () ERC721("Macro Alumni Soulbound Token", "MASBT") {}

    /// @notice Emitted when the locking status is changed to locked.
    /// @dev If a token is minted and the status is locked, this event should be emitted.
    /// @param tokenId The identifier for a token.
    event Locked(uint256 tokenId);

    /// @notice Emitted when the locking status is changed to unlocked.
    /// @dev If a token is minted and the status is unlocked, this event should be emitted.
    /// @param tokenId The identifier for a token.
    event Unlocked(uint256 tokenId);

    /// @notice TODO
    /// @dev TODO
    /// @param proof merkle proof
    function mint (uint16 blockNumber, GraduationTiers graduationTier, bytes32[] calldata proof) external {
        require(_verify(_leaf(msg.sender, blockNumber, graduationTier), proof), "INVALID_PROOF");
        require(addressToAlumniData[msg.sender].claimed == false && addressToAlumniData[msg.sender].burned == false, "CLAIMED");

        addressToAlumniData[msg.sender].claimed = true;
        addressToAlumniData[msg.sender].blockNumber = blockNumber;
        addressToAlumniData[msg.sender].graduationTier = graduationTier;

        _mint(msg.sender, tokenSupply);

        approve(owner(), tokenSupply);

        unchecked {
            tokenSupply++;
        }


        emit Locked(tokenSupply);
    }

    /// @notice TODO
    /// @dev before calling burn, make sure to remove the owner's address from the merkletree and update the merkleroot by calling setMerkleRoot first to prevent the alumni from minting a token from the address that is having its token burned
    /// @param tokenId tokenId which will be burned
    function burn (uint256 tokenId) external onlyOwner {
        address owner = ownerOf(tokenId);
        addressToAlumniData[owner].burned = true;
        _burn(tokenId);
    }

    /// @notice TODO
    /// @dev TODO
    /// @param from address of token holder wishing to transfer their token
    /// @param to address the token will be transfered to
    /// @param id token id that will be transfered
    function transferFrom(
        address from,
        address to,
        uint256 id
    ) public override onlyOwner { 
        super.transferFrom(from, to, id);
    }

    /// @notice TODO
    /// @dev TODO
    /// @param id the token id for the asset being requested
    function tokenURI(uint256 id) public view override returns (string memory) {
        ownerOf(id); // ownerOf will revert if the token does not exist
        return string.concat(baseTokenURI, Strings.toString(id), ".json");
    }

    /// @notice TODO
    /// @dev TODO
    /// @param _baseURI the URI which returns the NFT metadata
    function setBaseURI (string calldata _baseURI) external onlyOwner {
        baseTokenURI = _baseURI;
    }

    /// @notice TODO
    /// @dev TODO
    /// @param _root the new merkle root
    function setMerkleRoot (bytes32 _root) external onlyOwner {
        root = _root;
    }

    /// @notice TODO
    /// @dev TODO
    /// @param tokenId the id for the SBT token
    function tokenIdToAlumniData (uint256 tokenId) external view returns (AlumniData memory) {
        address owner = ownerOf(tokenId);
        return addressToAlumniData[owner];
    }

    function supportsInterface(bytes4 interfaceId) public pure override returns (bool) {
        return 
            interfaceId == 0xb45a3c0e || // ERC165 Interface ID for ERC5192
            interfaceId == 0x01ffc9a7 || // ERC165 Interface ID for ERC165
            interfaceId == 0x80ac58cd || // ERC165 Interface ID for ERC721
            interfaceId == 0x5b5e139f;   // ERC165 Interface ID for ERC721Metadata
    }

    /// @notice Returns the locking status of an Soulbound Token
    /// @dev SBTs assigned to zero address are considered invalid, and queries
    /// about them do throw.
    /// @param tokenId The identifier for an SBT.
    function locked(uint256 tokenId) external view returns (bool) {
        return true;
    }

    function _leaf(address account, uint16 blockNumber, GraduationTiers graduationTier) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(account, blockNumber, graduationTier));
    }

    function _verify(bytes32 leaf, bytes32[] memory proof) internal view returns (bool) {
        return MerkleProof.verify(proof, root, leaf);
    }

}