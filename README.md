# Macro Alumi Soulbound NFTs

This repo holds the contract code and test suite for the Macro Alumni SBTs.

The Macro Alumni Souldbound Token's goal is to create a non-transferable on-chain record of Macro alumni that documents the block number of each alumni as well as the tier they graduated in. Given the soul bound nature of these tokens, in order to obtain one it must be earned through hard work by completing the Macro fellowship.

## Technical Details

- **Contract:** Extends a customized version of [Solmate’s ERC-721.sol](https://github.com/transmissions11/solmate/blob/main/src/tokens/ERC721.sol) & implements [ERC-5192](https://eips.ethereum.org/EIPS/eip-5192) ”Minimal Soulbound NFT” standard

- **Contract Ownership:** A new multisig will be instantiated with instruction team members as signers for admin tasks recurring tasks like updating the merkle root, transferring & burning tokens, etc.

  - Admin Features
    - Update Merkle Root (Staff: “New graduates!”) (`setMerkleRoot`)
    - Mint NFTs on behalf of alumni (Staff: “Gift SBTs to og alumni!”) (`batchAirdrop`)
    - Burn existing NFT (Student: “I quit!”) (`burn`)
    - Transfer NFT (Student: “I changed my ETH address!”) (`transferFrom`)
    - Update Graduation Tier (Staff: “Oops, we messed up while grading.”) (`updateStudentGraduationTier`)
    - Update Block Number (Student: “ Re-enrolled.”) (`updateStudentBlockNumber`)
    - Update Image URI (Staff: “Art isn’t dope enough.”) (`setBaseURI`)

- **Soul Bound:** Override `transferFrom` ⇒ becomes `onlyAdmin` & supports [ERC-5192](https://eips.ethereum.org/EIPS/eip-5192)

- **Minting:** We will implement a merkle drop claim system, which will require students to pay the gas to mint their own NFTs, and Macro will have to update the merkle root once per block so new graduates can claim. (1 tx per block ^\_^)
- On-Chain Storage Data (in addition to the default ERC721 and ERC5192 interfaces)
  - `mapping(address => AlumniData) public addressToAlumniData`
    - `AlumniData` struct:
      - `bool` Exists
      - `uint` Block Number (Cohort ID)
      - `enum` NFT Graduation Tier
        - Honors Tier Grad
        - Engineers Tier Grad
        - Founders Tier Grad
        - OG Graduate (Graduated before tiers existed) (Holographic Charizard)
        - Alum (Did not graduate, but did complete course requirements.)
  - `mapping(address => bool) public claimed`
  - `string baseTokenURI`
  - `bytes32 public root`
  - `uint256 public tokenSupply`
- **Art**
  - Given that the art will be stored off-chain, we do not need to worry about it at this stage, since we know we will be accessing it via the `tokenURI` function.
  - The art will be served from a server that we host
