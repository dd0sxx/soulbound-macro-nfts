import { MacroAlumniSBT } from "./../typechain-types/contracts/MacroAlumniSBT";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

enum GraduationTiers {
  HONORS,
  ENGINEERS,
  FOUNDERS,
  OG,
  ALUM,
}

interface StudentMerkleLeaf {
  address: string;
  blockNumber: number;
  graduationTier: GraduationTiers;
}

let dataRaw: StudentMerkleLeaf[] = [
  {
    address: "0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef",
    blockNumber: 0,
    graduationTier: GraduationTiers.OG,
  },
  {
    address: "0xfeedfeedfeedfeedfeedfeedfeedfeedfeedfeed",
    blockNumber: 4,
    graduationTier: GraduationTiers.ALUM,
  },
  {
    address: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    blockNumber: 7,
    graduationTier: GraduationTiers.ENGINEERS,
  },
  {
    address: "0x7Eb696df980734DD592EBDd9dfC39F189aDc5456",
    blockNumber: 1,
    graduationTier: GraduationTiers.HONORS,
  },
];

let merkleTree: any;

let alumni: StudentMerkleLeaf;

let generateMerkleTreeAndMint = async function () {
  dataRaw[0].address = otherAccount.address;
  alumni = dataRaw[0];

  generateMerkleTree();
  await contract.connect(owner).setMerkleRoot(merkleTree.getHexRoot());

  const leaf = ethers.utils.solidityKeccak256(
    ["address", "uint16", "uint8"],
    [alumni.address, alumni.blockNumber, alumni.graduationTier]
  );
  const proof = merkleTree.getHexProof(leaf);

  const tx = await contract
    .connect(otherAccount)
    .mint(alumni.address, alumni.blockNumber, alumni.graduationTier, proof);

  const receipt = await tx.wait();
  const tokenId = receipt.events[1].args.tokenId.toHexString();
  return tokenId;
};

function generateMerkleTree(): any {
  const leaves = dataRaw.map((x) =>
    ethers.utils.solidityKeccak256(
      ["address", "uint16", "uint8"],
      [x.address, x.blockNumber, x.graduationTier]
    )
  );
  merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
}

let owner: SignerWithAddress,
  otherAccount: SignerWithAddress,
  otherOtherAccount: SignerWithAddress,
  differentAlumni: SignerWithAddress,
  differentOwner: SignerWithAddress;
let contract: MacroAlumniSBT;

describe("Macro Alumni Soulbound Token", function () {
  beforeEach(async function () {
    [owner, otherAccount, otherOtherAccount, differentAlumni, differentOwner] =
      await ethers.getSigners();
    generateMerkleTree();
    const Contract = await ethers.getContractFactory("MacroAlumniSBT");
    contract = await Contract.connect(otherOtherAccount).deploy(
      "ipfs://deadbeef/",
      merkleTree.getHexRoot(),
      owner.address
    );
  });

  it("Should support interfaces", async function () {
    expect(await contract.supportsInterface("0xb45a3c0e")).to.deep.equal(true);
    expect(await contract.supportsInterface("0x01ffc9a7")).to.deep.equal(true);
    expect(await contract.supportsInterface("0x80ac58cd")).to.deep.equal(true);
    expect(await contract.supportsInterface("0x5b5e139f")).to.deep.equal(true);
  });

  it("Should initialize properly", async function () {
    expect(await contract.baseTokenURI()).to.deep.equal("ipfs://deadbeef/");
    expect(await contract.root()).to.deep.equal(merkleTree.getHexRoot());
    expect(await contract.owner()).to.deep.equal(owner.address);
  });

  it("Should allow owner to set merkle root", async function () {
    generateMerkleTree();
    let mr = merkleTree.getHexRoot();
    await contract.connect(owner).setMerkleRoot(mr);
    expect(await contract.root()).to.deep.equal(mr);
  });

  it("Should allow alumni to mint", async function () {
    dataRaw[0].address = otherAccount.address;
    const alumni = dataRaw[0];

    generateMerkleTree();
    await contract.connect(owner).setMerkleRoot(merkleTree.getHexRoot());

    const leaf = ethers.utils.solidityKeccak256(
      ["address", "uint16", "uint8"],
      [alumni.address, alumni.blockNumber, alumni.graduationTier]
    );
    const proof = merkleTree.getHexProof(leaf);

    const tx = await contract
      .connect(otherAccount)
      .mint(alumni.address, alumni.blockNumber, alumni.graduationTier, proof);

    const receipt = await tx.wait();

    const tokenId = receipt.events[1].args.tokenId.toHexString();

    expect(await contract.ownerOf(tokenId)).to.deep.equal(alumni.address);
    expect(await contract.blockNumber(tokenId)).to.deep.equal(
      alumni.blockNumber
    );
    expect(await contract.graduationTier(tokenId)).to.deep.equal(
      alumni.graduationTier
    );
  });

  it("Should allow alumni to mint an SBT to a different address than their own", async function () {
    dataRaw[0].address = otherAccount.address;
    const alumni = dataRaw[0];

    generateMerkleTree();
    await contract.connect(owner).setMerkleRoot(merkleTree.getHexRoot());

    const leaf = ethers.utils.solidityKeccak256(
      ["address", "uint16", "uint8"],
      [alumni.address, alumni.blockNumber, alumni.graduationTier]
    );
    const proof = merkleTree.getHexProof(leaf);

    const tx = await contract
      .connect(otherAccount)
      .mint(
        differentAlumni.address,
        alumni.blockNumber,
        alumni.graduationTier,
        proof
      );

    const receipt = await tx.wait();

    const tokenId = receipt.events[1].args.tokenId.toHexString();

    expect(await contract.ownerOf(tokenId)).to.deep.equal(
      differentAlumni.address
    );
    expect(await contract.blockNumber(tokenId)).to.deep.equal(
      alumni.blockNumber
    );
    expect(await contract.graduationTier(tokenId)).to.deep.equal(
      alumni.graduationTier
    );
  });

  it("Should not allow non alumni to mint, even with a valid proof", async function () {
    dataRaw[0].address = otherAccount.address;
    const alumni = dataRaw[0];

    generateMerkleTree();
    await contract.connect(owner).setMerkleRoot(merkleTree.getHexRoot());

    const leaf = ethers.utils.solidityKeccak256(
      ["address", "uint16", "uint8"],
      [alumni.address, alumni.blockNumber, alumni.graduationTier]
    );
    const proof = merkleTree.getHexProof(leaf);

    expect(
      contract.mint(
        alumni.address,
        alumni.blockNumber,
        alumni.graduationTier,
        proof
      )
    ).to.be.revertedWith("INVALID_PROOF");
  });

  it("Should not allow an alumni to claim twice", async function () {
    const tokenId = await generateMerkleTreeAndMint();

    expect(await contract.ownerOf(tokenId)).to.deep.equal(alumni.address);
    expect(await contract.blockNumber(tokenId)).to.deep.equal(
      alumni.blockNumber
    );
    expect(await contract.graduationTier(tokenId)).to.deep.equal(
      alumni.graduationTier
    );

    const leaf = ethers.utils.solidityKeccak256(
      ["address", "uint16", "uint8"],
      [alumni.address, alumni.blockNumber, alumni.graduationTier]
    );
    const proof = merkleTree.getHexProof(leaf);

    expect(
      contract
        .connect(otherAccount)
        .mint(alumni.address, alumni.blockNumber, alumni.graduationTier, proof)
    ).to.be.revertedWith("CLAIMED");
  });

  it("Admin can burn tokens", async function () {
    const tokenId = await generateMerkleTreeAndMint();

    expect(await contract.ownerOf(tokenId)).to.deep.equal(alumni.address);
    expect(await contract.blockNumber(tokenId)).to.deep.equal(
      alumni.blockNumber
    );
    expect(await contract.graduationTier(tokenId)).to.deep.equal(
      alumni.graduationTier
    );

    expect(contract.connect(otherAccount).burn(tokenId)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );

    await contract.connect(owner).burn(tokenId);
    expect(await contract.balanceOf(alumni.address)).to.deep.equal(0);
    expect(contract.ownerOf(tokenId)).to.be.revertedWith("NOT_MINTED");
  });

  it("Tokens are locked and non-transferable", async function () {
    const tokenId = await generateMerkleTreeAndMint();

    expect(await contract.locked(tokenId)).to.deep.equal(true);

    expect(
      contract
        .connect(otherAccount)
        .transferFrom(otherAccount.address, owner.address, 0)
    ).to.be.revertedWith("");
  });

  it("Should return the correct token URI", async function () {
    const tokenId = await generateMerkleTreeAndMint();

    await contract.connect(owner).setBaseURI("https://0xmacro.com/alumniSBT/");

    expect(await contract.tokenURI(tokenId)).to.deep.equal(
      `https://0xmacro.com/alumniSBT/${tokenId}.json`
    );
  });

  it("Should revert when locked is called with an invalid token id", async function () {
    expect(contract.locked(0)).to.be.revertedWith("INVALID_TOKEN");
    const tokenId = await generateMerkleTreeAndMint();
    expect(await contract.locked(tokenId)).to.deep.equal(true);
    await contract.connect(owner).burn(tokenId);
    expect(contract.locked(tokenId)).to.be.revertedWith("INVALID_TOKEN");
  });

  it("Should allow admin to update a students graduation tier", async function () {
    const tokenId = await generateMerkleTreeAndMint();
    expect(await contract.ownerOf(tokenId)).to.deep.equal(alumni.address);
    expect(await contract.blockNumber(tokenId)).to.deep.equal(
      alumni.blockNumber
    );
    expect(await contract.graduationTier(tokenId)).to.deep.equal(
      alumni.graduationTier
    );

    await contract.connect(owner).burn(tokenId);

    expect(contract.ownerOf(tokenId)).to.be.revertedWith("");
    expect(await contract.balanceOf(alumni.address)).to.deep.equal(0);

    await contract
      .connect(owner)
      .batchAirdrop(
        [alumni.address],
        [alumni.blockNumber],
        [alumni.graduationTier]
      );

    expect(await contract.ownerOf(tokenId)).to.deep.equal(alumni.address);
    expect(await contract.blockNumber(tokenId)).to.deep.equal(
      alumni.blockNumber
    );
    expect(await contract.graduationTier(tokenId)).to.deep.equal(
      alumni.graduationTier
    );

    const leaf = ethers.utils.solidityKeccak256(
      ["address", "uint16", "uint8"],
      [alumni.address, alumni.blockNumber, alumni.graduationTier]
    );
    const proof = merkleTree.getHexProof(leaf);

    expect(
      contract
        .connect(otherAccount)
        .mint(alumni.address, alumni.blockNumber, alumni.graduationTier, proof)
    ).to.be.revertedWith("ALREADY_MINTED");
  });

  it("Should protect against non-admin calls to safeTransferFrom", async function () {
    expect(
      contract
        .connect(otherAccount)
        ["safeTransferFrom(address,address,uint256)"](
          otherAccount.address,
          owner.address,
          0
        )
    ).to.be.revertedWith("Ownable: caller is not the owner");
    expect(
      contract
        .connect(otherAccount)
        ["safeTransferFrom(address,address,uint256,bytes)"](
          otherAccount.address,
          owner.address,
          0,
          "0xdeadbeef"
        )
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("Should batch airdrop to graduated", async function () {
    const tx = await contract.connect(owner).batchAirdrop(
      dataRaw.map((alumni) => alumni.address),
      dataRaw.map((alumni) => alumni.blockNumber),
      dataRaw.map((alumni) => alumni.graduationTier)
    );

    const receipt = await tx.wait();

    let tokenIds = [];

    tokenIds.push(receipt.events[1].args.tokenId.toHexString());
    tokenIds.push(receipt.events[3].args.tokenId.toHexString());
    tokenIds.push(receipt.events[5].args.tokenId.toHexString());
    tokenIds.push(receipt.events[7].args.tokenId.toHexString());

    for (let i = 0; i < dataRaw.length; i++) {
      let alumni = dataRaw[i];
      expect(await contract.balanceOf(alumni.address)).to.deep.equal(1);
      expect(await contract.blockNumber(tokenIds[i])).to.deep.equal(
        alumni.blockNumber
      );
      expect(await contract.graduationTier(tokenIds[i])).to.deep.equal(
        alumni.graduationTier
      );
    }

    expect(
      contract.connect(owner).batchAirdrop(
        dataRaw.map((alumni) => alumni.address),
        dataRaw.map((alumni) => alumni.blockNumber),
        dataRaw.map((alumni) => alumni.graduationTier)
      )
    ).to.be.revertedWith("CLAIMED");

    expect(contract.connect(owner).batchAirdrop([], [], [])).to.be.revertedWith(
      "INCONSISTENT_LENGTH"
    );
    expect(
      contract
        .connect(owner)
        .batchAirdrop(["0xdeadbeefdeadbeefdeadbeefdeadbeefdead0000"], [1], [])
    ).to.be.revertedWith("INCONSISTENT_LENGTH");
    expect(
      contract
        .connect(owner)
        .batchAirdrop(["0xdeadbeefdeadbeefdeadbeefdeadbeefdead0000"], [], [1])
    ).to.be.revertedWith("INCONSISTENT_LENGTH");
  });
});
