// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.17;

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

/// @notice this struct contains all of the data important to an alumni's graduation
/// @param exists true if this struct has been assigned to an SBT
/// @param blockNumber Macro refers to each group of students as a "block", and the first
/// group of students who graduated were part of block 0
/// @param graduationTier the ranking of the alumni
struct AlumniData {
    bool exists;
    uint16 blockNumber;
    GraduationTiers graduationTier;
}

contract MacroAlumniSBT is ERC721, Ownable {
    /// @notice the total number of tokens, and the ID of the next SBT to be minted
    uint256 public tokenSupply;
    /// @notice baseURI where the SBT metadata is located
    string public baseTokenURI;

    /// @notice the Merkle root used to prove inclusion in the MerkleDrop
    bytes32 public root; // merkle root

    /// @notice mapping used to store info about the alumni's SBT
    mapping(address => AlumniData) public addressToAlumniData;

    /// @notice mapping used to keep track of which addresses have
    /// already claimed their SBT
    mapping(address => bool) public claimed;

    /// @param _baseURI the URI which returns the SBT metadata
    /// @param _root the new merkle root
    /// @param _owner the address of the admin of the contract
    constructor(
        string memory _baseURI,
        bytes32 _root,
        address _owner
    ) ERC721("Macro Alumni Soulbound Token", "MASBT") {
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
        require(claimed[msg.sender] == false, "CLAIMED");
        require(addressToAlumniData[to].exists == false, "ALREADY_EXISTS");

        claimed[msg.sender] = true;

        addressToAlumniData[to].exists = true;
        addressToAlumniData[to].blockNumber = blockNumber;
        addressToAlumniData[to].graduationTier = graduationTier;

        // _safeMint over _mint to prevent sbts being minted to addesses that are not eligible ERC721 token receivers
        _safeMint(to, tokenSupply);

        // ensure that the Instruction team can always transfer tokens
        address owner = owner();
        isApprovedForAll[to][owner] = true;
        emit ApprovalForAll(to, owner, true);

        emit Locked(tokenSupply);

        unchecked {
            tokenSupply++;
        }
    }

    /// @notice burn does not delete alumni data stored in addressToAlumniData to save gas -- it does however delete the token from the ERC721 implementation
    /// @dev before calling burn, make sure to remove the owner's address from the merkletree and update the merkleroot by calling setMerkleRoot first to prevent the alumni from minting a token from the address that is having its token burned
    /// @param tokenId tokenId which will be burned
    function burn(uint256 tokenId) external onlyOwner {
        address owner = ownerOf(tokenId);
        delete addressToAlumniData[owner];
        _burn(tokenId);
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
        require(from != to, "INVALID");

        AlumniData storage alumniData = addressToAlumniData[from];
        addressToAlumniData[to] = alumniData;
        delete addressToAlumniData[from];

        // ensure that the Instruction Team is always able to transfer minted tokens.
        // Note: this will mean that the owner will slowly build up isApprovedForAll's
        // across all the `to` addresses. It's not elegant, but it's OK since transfers
        // are expected to be very infrequent.
        address owner = owner();
        if (isApprovedForAll[to][owner] == false) {
            isApprovedForAll[to][owner] = true;
            emit ApprovalForAll(to, owner, true);
        }

        super.transferFrom(from, to, id);
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

    /// @notice set a new graduationTier for a particular address that holds an SBT
    /// @param alumniAddress the address that owns the SBT
    /// @param newTier the new tier for this SBT
    function updateStudentGraduationTier(
        address alumniAddress,
        GraduationTiers newTier
    ) external onlyOwner {
        addressToAlumniData[alumniAddress].graduationTier = newTier;
    }

    /// @notice set a new blockNumber for a particular address that holds an SBT
    /// @param alumniAddress the address that owns the SBT
    /// @param newNumber the new block for this SBT
    function updateStudentBlockNumber(
        address alumniAddress,
        uint16 newNumber
    ) external onlyOwner {
        addressToAlumniData[alumniAddress].blockNumber = newNumber;
    }

    /// @notice this is a convience function to enable alumni data to be queried by token id rather than by owner address
    /// @param tokenId the id for the SBT token
    function tokenIdToAlumniData(uint256 tokenId)
        external
        view
        returns (AlumniData memory)
    {
        address owner = ownerOf(tokenId);
        return addressToAlumniData[owner];
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
        require(ownerOf(tokenId) != address(0), "INVALID_TOKEN");
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
