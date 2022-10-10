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
    blockNumber: 1,
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

  await contract
    .connect(otherAccount)
    .mint(alumni.address, alumni.blockNumber, alumni.graduationTier, proof);
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

    await contract
      .connect(otherAccount)
      .mint(alumni.address, alumni.blockNumber, alumni.graduationTier, proof);

    expect(await contract.ownerOf(0)).to.deep.equal(alumni.address);
    expect(await contract.addressToAlumniData(alumni.address)).to.deep.equal([
      true,
      1,
      3,
    ]);
    expect(await contract.tokenIdToAlumniData(0)).to.deep.equal([true, 1, 3]);
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

    await contract
      .connect(otherAccount)
      .mint(
        differentAlumni.address,
        alumni.blockNumber,
        alumni.graduationTier,
        proof
      );

    expect(await contract.ownerOf(0)).to.deep.equal(differentAlumni.address);
    expect(
      await contract.addressToAlumniData(differentAlumni.address)
    ).to.deep.equal([true, 1, 3]);
    expect(await contract.tokenIdToAlumniData(0)).to.deep.equal([true, 1, 3]);
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
    await generateMerkleTreeAndMint();

    expect(await contract.ownerOf(0)).to.deep.equal(alumni.address);
    expect(await contract.addressToAlumniData(alumni.address)).to.deep.equal([
      true,
      1,
      3,
    ]);
    expect(await contract.tokenIdToAlumniData(0)).to.deep.equal([true, 1, 3]);

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

  it("Should not allow one alumni to overwrite the data of another alumni when minting their SBT", async function () {
    dataRaw[1].address = differentAlumni.address;

    await generateMerkleTreeAndMint();

    expect(await contract.ownerOf(0)).to.deep.equal(otherAccount.address);
    expect(
      await contract.addressToAlumniData(otherAccount.address)
    ).to.deep.equal([true, 1, 3]);
    expect(await contract.tokenIdToAlumniData(0)).to.deep.equal([true, 1, 3]);

    const leaf = ethers.utils.solidityKeccak256(
      ["address", "uint16", "uint8"],
      [
        differentAlumni.address,
        dataRaw[1].blockNumber,
        dataRaw[1].graduationTier,
      ]
    );
    const proof = merkleTree.getHexProof(leaf);

    expect(
      contract
        .connect(differentAlumni)
        .mint(
          otherAccount.address,
          dataRaw[1].blockNumber,
          dataRaw[1].graduationTier,
          proof
        )
    ).to.be.revertedWith("ALREADY_EXISTS");

    // now successfully mint to a different address
    await contract
      .connect(differentAlumni)
      .mint(
        differentAlumni.address,
        dataRaw[1].blockNumber,
        dataRaw[1].graduationTier,
        proof
      );
  });

  it("Admin can burn tokens", async function () {
    await generateMerkleTreeAndMint();

    expect(await contract.ownerOf(0)).to.deep.equal(alumni.address);
    expect(await contract.addressToAlumniData(alumni.address)).to.deep.equal([
      true,
      1,
      3,
    ]);
    expect(await contract.tokenIdToAlumniData(0)).to.deep.equal([true, 1, 3]);

    expect(contract.connect(otherAccount).burn(0)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );

    await contract.connect(owner).burn(0);
    expect(await contract.balanceOf(alumni.address)).to.deep.equal(0);
    expect(await contract.addressToAlumniData(alumni.address)).to.deep.equal([
      false,
      0,
      0,
    ]);
    expect(contract.tokenIdToAlumniData(0)).to.be.revertedWith("NOT_MINTED");
  });

  it("Alumni cannot mint token after their token has been burned", async function () {
    await generateMerkleTreeAndMint();

    const leaf = ethers.utils.solidityKeccak256(
      ["address", "uint16", "uint8"],
      [alumni.address, alumni.blockNumber, alumni.graduationTier]
    );
    const proof = merkleTree.getHexProof(leaf);

    await contract.connect(owner).burn(0);

    expect(
      contract
        .connect(otherAccount)
        .mint(alumni.address, alumni.blockNumber, alumni.graduationTier, proof)
    ).to.be.revertedWith("CLAIMED");
  });

  it("Tokens are locked and non-transferable", async function () {
    await generateMerkleTreeAndMint();

    expect(await contract.locked(0)).to.deep.equal(true);

    expect(
      contract
        .connect(otherAccount)
        .transferFrom(otherAccount.address, owner.address, 0)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("cannot transfer token to current holder", async function () {
    await generateMerkleTreeAndMint();

    expect(await contract.locked(0)).to.deep.equal(true);
    expect(
      await contract.addressToAlumniData(otherAccount.address)
    ).to.deep.equal([true, 1, 3]);
    expect(
      await contract.addressToAlumniData(otherOtherAccount.address)
    ).to.deep.equal([false, 0, 0]);

    expect(
      contract
        .connect(owner)
        .transferFrom(otherAccount.address, otherAccount.address, 0)
    ).to.be.revertedWith("INVALID");
  });

  it("Admins can transfer tokens on behalf of alumni", async function () {
    await generateMerkleTreeAndMint();

    expect(await contract.locked(0)).to.deep.equal(true);
    expect(
      await contract.addressToAlumniData(otherAccount.address)
    ).to.deep.equal([true, 1, 3]);
    expect(
      await contract.addressToAlumniData(otherOtherAccount.address)
    ).to.deep.equal([false, 0, 0]);

    await contract
      .connect(owner)
      .transferFrom(otherAccount.address, otherOtherAccount.address, 0);
    expect(await contract.ownerOf(0)).to.deep.equal(otherOtherAccount.address);
    expect(
      await contract.addressToAlumniData(otherAccount.address)
    ).to.deep.equal([false, 0, 0]);
    expect(
      await contract.addressToAlumniData(otherOtherAccount.address)
    ).to.deep.equal([true, 1, 3]);
  });

  it("Should still allow the owner to transfer SBT's, even after they transfer", async function () {
    await generateMerkleTreeAndMint();

    expect(await contract.locked(0)).to.deep.equal(true);
    expect(
      await contract.addressToAlumniData(otherAccount.address)
    ).to.deep.equal([true, 1, 3]);
    expect(
      await contract.addressToAlumniData(otherOtherAccount.address)
    ).to.deep.equal([false, 0, 0]);

    // transfer the first time
    await contract
      .connect(owner)
      .transferFrom(otherAccount.address, otherOtherAccount.address, 0);
    expect(await contract.ownerOf(0)).to.deep.equal(otherOtherAccount.address);
    expect(
      await contract.addressToAlumniData(otherAccount.address)
    ).to.deep.equal([false, 0, 0]);
    expect(
      await contract.addressToAlumniData(otherOtherAccount.address)
    ).to.deep.equal([true, 1, 3]);

    // transfer the second time
    await contract
      .connect(owner)
      .transferFrom(otherOtherAccount.address, owner.address, 0);
    expect(await contract.ownerOf(0)).to.deep.equal(owner.address);
    expect(
      await contract.addressToAlumniData(otherOtherAccount.address)
    ).to.deep.equal([false, 0, 0]);
    expect(await contract.addressToAlumniData(owner.address)).to.deep.equal([
      true,
      1,
      3,
    ]);
  });

  it("Should return the correct token URI", async function () {
    await generateMerkleTreeAndMint();

    await contract.connect(owner).setBaseURI("https://0xmacro.com/alumniSBT/");

    expect(await contract.tokenURI(0)).to.deep.equal(
      "https://0xmacro.com/alumniSBT/0.json"
    );
  });

  it("Should revert when locked is called with an invalid token id", async function () {
    expect(contract.locked(0)).to.be.revertedWith("INVALID_TOKEN");
    await generateMerkleTreeAndMint();
    expect(await contract.locked(0)).to.deep.equal(true);
    await contract.connect(owner).burn(0);
    expect(contract.locked(0)).to.be.revertedWith("INVALID_TOKEN");
  });

  it("Should allow admin to update a students graduation tier", async function () {
    await generateMerkleTreeAndMint();
    expect(await contract.addressToAlumniData(alumni.address)).to.deep.equal([
      true,
      1,
      3,
    ]);
    await contract
      .connect(owner)
      .updateStudentGraduationTier(alumni.address, 0);
    expect(await contract.addressToAlumniData(alumni.address)).to.deep.equal([
      true,
      1,
      0,
    ]);
    expect(
      contract.connect(owner).updateStudentGraduationTier(alumni.address, 6)
    ).to.be.revertedWith("function was called with incorrect parameters");
    expect(
      contract
        .connect(otherAccount)
        .updateStudentGraduationTier(alumni.address, 1)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("Should allow admin to update a students block number", async function () {
    await generateMerkleTreeAndMint();
    expect(await contract.addressToAlumniData(alumni.address)).to.deep.equal([
      true,
      1,
      3,
    ]);
    await contract.connect(owner).updateStudentBlockNumber(alumni.address, 0);
    expect(await contract.addressToAlumniData(alumni.address)).to.deep.equal([
      true,
      0,
      3,
    ]);
    expect(
      contract.connect(otherAccount).updateStudentBlockNumber(alumni.address, 1)
    ).to.be.revertedWith("Ownable: caller is not the owner");
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

  it("Should allow new owner to transfer tokens after transfering ownership of the contract", async function () {
    await generateMerkleTreeAndMint();

    expect(await contract.locked(0)).to.deep.equal(true);
    expect(
      await contract.addressToAlumniData(otherAccount.address)
    ).to.deep.equal([true, 1, 3]);
    expect(
      await contract.addressToAlumniData(otherOtherAccount.address)
    ).to.deep.equal([false, 0, 0]);

    await contract
      .connect(owner)
      .transferFrom(otherAccount.address, otherOtherAccount.address, 0);
    expect(await contract.ownerOf(0)).to.deep.equal(otherOtherAccount.address);
    expect(
      await contract.addressToAlumniData(otherAccount.address)
    ).to.deep.equal([false, 0, 0]);
    expect(
      await contract.addressToAlumniData(otherOtherAccount.address)
    ).to.deep.equal([true, 1, 3]);

    await contract.connect(owner).transferOwnership(differentOwner.address);

    await contract
      .connect(differentOwner)
      .transferFrom(otherOtherAccount.address, differentAlumni.address, 0);
    expect(await contract.ownerOf(0)).to.deep.equal(differentAlumni.address);
    expect(
      await contract.addressToAlumniData(otherOtherAccount.address)
    ).to.deep.equal([false, 0, 0]);
    expect(
      await contract.addressToAlumniData(differentAlumni.address)
    ).to.deep.equal([true, 1, 3]);
  });

  it("Should not break when transfering ownership of the contract after tokens have been burned", async function () {
    await generateMerkleTreeAndMint();
    dataRaw[1].address = differentAlumni.address;
    const alumni = dataRaw[1];
    const leaf = ethers.utils.solidityKeccak256(
      ["address", "uint16", "uint8"],
      [alumni.address, alumni.blockNumber, alumni.graduationTier]
    );
    const proof = merkleTree.getHexProof(leaf);
    await contract
      .connect(differentAlumni)
      .mint(alumni.address, alumni.blockNumber, alumni.graduationTier, proof);

    expect(await contract.ownerOf(0)).to.deep.equal(otherAccount.address);
    expect(await contract.ownerOf(1)).to.deep.equal(differentAlumni.address);
    expect(await contract.locked(0)).to.deep.equal(true);
    expect(await contract.locked(1)).to.deep.equal(true);
    expect(
      await contract.addressToAlumniData(otherAccount.address)
    ).to.deep.equal([true, 1, 3]);
    expect(
      await contract.addressToAlumniData(differentAlumni.address)
    ).to.deep.equal([true, 4, 4]);
    expect(
      await contract.addressToAlumniData(otherOtherAccount.address)
    ).to.deep.equal([false, 0, 0]);

    await contract.connect(owner).burn(0);
    expect(contract.ownerOf(0)).to.be.revertedWith("NOT_MINTED");
    expect(
      await contract.addressToAlumniData(otherAccount.address)
    ).to.deep.equal([false, 0, 0]);

    await contract.connect(owner).transferOwnership(differentOwner.address);
    expect(await contract.owner()).to.deep.equal(differentOwner.address);

    await contract
      .connect(differentOwner)
      .transferFrom(differentAlumni.address, otherOtherAccount.address, 1);
    expect(await contract.ownerOf(1)).to.deep.equal(otherOtherAccount.address);
    expect(
      await contract.addressToAlumniData(differentAlumni.address)
    ).to.deep.equal([false, 0, 0]);
    expect(
      await contract.addressToAlumniData(otherOtherAccount.address)
    ).to.deep.equal([true, 4, 4]);
  });

  it("Should batch airdrop to graduated", async function () {
    await contract.connect(owner).batchAirdrop(
      dataRaw.map(alumni => alumni.address),
      dataRaw.map(alumni => alumni.blockNumber),
      dataRaw.map(alumni => alumni.graduationTier),
    )

    expect(await contract.tokenSupply()).to.deep.equal(dataRaw.length)
    
    for (let i = 0; i < dataRaw.length; i++) {
      let alumni = dataRaw[i]
      expect(await contract.balanceOf(alumni.address)).to.deep.equal(1)
      expect(await contract.addressToAlumniData(alumni.address)).to.deep.equal([true, alumni.blockNumber, alumni.graduationTier])
    }
  })
});
