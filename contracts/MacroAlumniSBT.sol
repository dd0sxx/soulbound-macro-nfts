// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.15;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

import "solmate/src/tokens/ERC721.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

enum GraduationTiers { 
        HONORS,
        ENGINEERS,
        FOUNDERS,
        OG,
        ALUM
}

struct AlumniData {
        bool claimed;
        uint16 blockNumber;
        GraduationTiers graduationTier;
}


contract MacroAlumniSBT is ERC721 {

    uint256 tokenSupply; // total # of tokens
    string baseTokenURI; // baseURI where the NFT metadata is located
    address admin; // instruction multisig

    bytes32 public root; // merkle root 

    mapping (address => AlumniData) addressToAlumniData;

    constructor () ERC721("Macro Alumni Soulbound Token", "MASBT") {}

    modifier onlyAdmin {
        require(msg.sender == admin, "ONLY_ADMIN");
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

    /// @notice TODO
    /// @dev TODO
    /// @param proof merkle proof
    function mint (uint16 blockNumber, GraduationTiers graduationTier, bytes32[] calldata proof) external {
        require(_verify(_leaf(msg.sender, blockNumber, graduationTier), proof), "INVALID_PROOF");
        require(addressToAlumniData[msg.sender].claimed == false, "CLAIMED");

        addressToAlumniData[msg.sender].claimed = true;
        addressToAlumniData[msg.sender].blockNumber = blockNumber;
        addressToAlumniData[msg.sender].graduationTier = graduationTier;

        _mint(msg.sender, tokenSupply);
        unchecked {
            tokenSupply++;
        }

        emit Locked(tokenSupply);
    }

    /// @notice TODO
    /// @dev before calling burn, make sure to remove the owner's address from the merkletree and update the merkleroot by calling setMerkleRoot first to prevent the alumni from minting a token from the address that is having its token burned
    /// @param tokenId tokenId which will be burned
    function burn (uint256 tokenId) external onlyAdmin {
        address owner = ownerOf(tokenId);
        delete addressToAlumniData[owner];
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
    ) public override onlyAdmin { 
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
    function setBaseURI (string calldata _baseURI) external onlyAdmin {
        baseTokenURI = _baseURI;
    }

    function setMerkleRoot (bytes32 _root) external onlyAdmin {
        root = _root;
    }

    function tokenToAlumniData (uint256 tokenId) external view returns (AlumniData memory) {
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