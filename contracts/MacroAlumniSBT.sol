// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.17;

import "./ERC721Admin.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

enum GraduationTiers {
    HONORS,
    ENGINEERS,
    FOUNDERS,
    OG,
    ALUM
}

contract MacroAlumniSBT is ERC721Admin {

    /// @notice baseURI where the SBT metadata is located
    string public baseTokenURI;

    /// @notice the Merkle root used to prove inclusion in the MerkleDrop
    bytes32 public root; // merkle root

    /// @param _baseURI the URI which returns the SBT metadata
    /// @param _root the new merkle root
    /// @param _owner the address of the admin of the contract
    constructor(
        string memory _baseURI,
        bytes32 _root,
        address _owner
    ) ERC721Admin("Macro Alumni Soulbound Token", "MASBT") {
        baseTokenURI = _baseURI;
        emit BaseURISet(_baseURI);
        root = _root;
        emit MerkleRootSet(_root);
        transferOwnership(_owner);
    }

    /// @notice Emitted when the locking status is changed to locked.
    /// @dev If a token is minted and the status is locked, this event should be emitted.
    /// @param tokenId The identifier for a token
    event Locked(uint256 tokenId);

    /// @notice Emitted when the setMerkleRoot function is called successfully
    /// @param root The new merkle root
    event MerkleRootSet(bytes32 root);

    /// @notice Emitted when the setBaseURI function is called successfully
    /// @param baseURI The new baseTokenURI
    event BaseURISet(string baseURI);

    /// @notice Function for alumni to claim their SBT
    /// @param to address they would like to soul bound the token to
    /// @param blockNumber the block (cohort) number that a given alumni graduated in
    /// @param graduationTier enum representing how well an alumni did in the fellowship
    /// @param proof merkle proof to be generated by frontend tool
    function mint(
        address to,
        uint16 blockNumber,
        GraduationTiers graduationTier,
        bytes32[] calldata proof
    ) external {
        require(
           _verify(_leaf(msg.sender, blockNumber, graduationTier), proof),
            "INVALID_PROOF"
         );
        uint256 tokenId =  ( uint256(uint160(msg.sender)) << uint256(24) ) + ( uint256(blockNumber) << uint256(8) ) + uint256(uint8(graduationTier));
        _create(to, tokenId);
    }

    /// @notice Function for admin to gift NFTs to alumni
    /// @dev all arrays must be of the same length and the indexes of each array correspond to the same alumni data across each array
    /// @param addresses array of alumni addresses which will receive tokens
    /// @param blockNumbers and array of block (cohort) numbers that a given alumni graduated in
    /// @param gradTiers array of enums representing how well an alumni did in the fellowship
    function batchAirdrop (
        address[] calldata addresses, 
        uint16[] calldata blockNumbers, 
        GraduationTiers[] calldata gradTiers
        ) external onlyOwner {
            uint length = addresses.length;
            require(length > 0 && length == blockNumbers.length && length == gradTiers.length, "INCONSISTENT_LENGTH");
            unchecked {
                for (uint i; i < length; ++i) {
                    address currentAddress = addresses[i];
                    uint256 tokenId = uint256(uint160(currentAddress)) << uint256(24) + uint256(blockNumbers[i]) << uint256(8) + uint256(uint8(gradTiers[i]));
                    _create(addresses[i], tokenId);
                }
            }
    }

    /// @notice burn deletes alumni data stored in addressToAlumniData and deletes the token from the ERC721 implementation
    /// @param tokenId tokenId which will be burned
    function burn(uint256 tokenId) external onlyOwner {
        address owner = ownerOf(tokenId);
        _burn(tokenId);
    }

    /// @dev private function to abstract duplicate logic in mint and batchAirdrop
    /// @param to address receiving the token
    /// @param tokenId the token id to be minted
    function _create(address to, uint256 tokenId) private {
        _safeMint(to, tokenId); 
		emit Locked(tokenId);
    }

    /// @dev onlyOwner incase the admin needs to transfer a token on behalf of an alumni
    /// @param from address of token holder wishing to transfer their token
    /// @param to address the token will be transfered to
    /// @param id token id that will be transfered
    function transferFrom(
        address from,
        address to,
        uint256 id
    ) public override onlyOwner {
        revert("NON_TRANSFERABLE");
    }

    function blockNumber (uint256 tokenId) external pure returns (uint16) {
        uint256 bnMask = 79228162514264337593543950335;
        uint16 bn = uint16((tokenId >> uint256(8)) & bnMask);
        return bn;
    }
    function graduationTier (uint256 tokenId) external pure returns (uint16) {
        uint256 bnMask = 79228162514264337593543950335;
        uint16 gradTier = uint16((tokenId >> uint256(8)) & bnMask);
        return gradTier;
    }

    /// @dev returns the location of the asset corresponding to a specific token id
    /// @param id the token id for the asset being requested
    function tokenURI(uint256 id) public view override returns (string memory) {
        ownerOf(id); // ownerOf will revert if the token does not exist
        return string.concat(baseTokenURI, Strings.toString(id), ".json");
    }

    /// @dev updates the base uri in storage where the assets for the colleciton are held
    /// @param _baseURI the URI which returns the NFT metadata
    function setBaseURI(string calldata _baseURI) external onlyOwner {
        baseTokenURI = _baseURI;
        emit BaseURISet(_baseURI);
    }

    /// @notice this function will need to be called at the end of every block to enable new grads to claim their tokens
    /// @param _root the new merkle root
    function setMerkleRoot(bytes32 _root) external onlyOwner {
        root = _root;
        emit MerkleRootSet(_root);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        pure
        override
        returns (bool)
    {
        return
            interfaceId == 0xb45a3c0e || // ERC165 Interface ID for ERC5192
            interfaceId == 0x01ffc9a7 || // ERC165 Interface ID for ERC165
            interfaceId == 0x80ac58cd || // ERC165 Interface ID for ERC721
            interfaceId == 0x5b5e139f; // ERC165 Interface ID for ERC721Metadata
    }

    /// @notice Returns the locking status of an Soulbound Token
    /// @dev SBTs assigned to zero address are considered invalid, and queries
    /// about them do throw.
    /// @param tokenId The identifier for an SBT.
    function locked(uint256 tokenId) external view returns (bool) {
        ownerOf(tokenId);
        return true;
    }

    /// @dev this function returns the hash of alumni data, also known as a leaf in our merkle tree
    /// @param account the alumni's address (is msg.sender)
    /// @param blockNumber the block (cohort) number that a given alumni graduated in
    /// @param graduationTier enum representing how well an alumni did in the fellowship
    function _leaf(
        address account,
        uint16 blockNumber,
        GraduationTiers graduationTier
    ) internal pure returns (bytes32) {
        return
            keccak256(abi.encodePacked(account, blockNumber, graduationTier));
    }

    /// @dev this function verifies if the leaf is found in the merkle tree
    /// @param leaf a hash of all the alumni's data
    /// @param proof a valid merkle proof. a merkle proof consists of the values to hash together with the value being proved to get back the Merkle root
    function _verify(bytes32 leaf, bytes32[] memory proof)
        internal
        view
        returns (bool)
    {
        return MerkleProof.verify(proof, root, leaf);
    }
}
