import { MacroAlumniSBT } from './../typechain-types/contracts/MacroAlumniSBT';
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import type { JsonRpcSigner } from "@ethersproject/providers/src.ts/json-rpc-provider"
import { expect } from "chai";
import { ethers } from "hardhat";
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

enum  GraduationTiers { 
  HONORS,
  ENGINEERS,
  FOUNDERS,
  OG,
  ALUM
}

interface StudentMerkleLeaf {
  address: string,
  blockNumber: number
  graduationTier: GraduationTiers
}

let dataRaw: StudentMerkleLeaf[] = [
  {
    address: "0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef",
    blockNumber: 1,
    graduationTier: GraduationTiers.OG
  },
  {
    address: "0xfeedfeedfeedfeedfeedfeedfeedfeedfeedfeed",
    blockNumber: 4,
    graduationTier: GraduationTiers.ALUM
  },
  {
    address: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    blockNumber: 7,
    graduationTier: GraduationTiers.ENGINEERS
  },
  {
    address: "0x7Eb696df980734DD592EBDd9dfC39F189aDc5456",
    blockNumber: 1,
    graduationTier: GraduationTiers.HONORS
  }
];

let merkleTree: any, leaves: string, proof: string[]

let alumni: StudentMerkleLeaf

let generateMerkleTreeAndMint = async function () {
  dataRaw[0].address = otherAccount.address
    alumni = dataRaw[0]
    
    generateMerkleTree()
    await contract.setMerkleRoot(merkleTree.getHexRoot());
    
    const leaf = ethers.utils.solidityKeccak256(["address", "uint16", "uint8"], [alumni.address, alumni.blockNumber, alumni.graduationTier])
    const proof = merkleTree.getHexProof(leaf);
    
    await contract.connect(otherAccount).mint(alumni.blockNumber, alumni.graduationTier, proof)
}

function generateMerkleTree (): any {
  leaves = dataRaw.map((x) => ethers.utils.solidityKeccak256(["address", "uint16", "uint8"], [x.address, x.blockNumber, x.graduationTier]));
  merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
}


let owner: SignerWithAddress, otherAccount: SignerWithAddress
let contract: MacroAlumniSBT

describe("Macro Alumni Soulbound Token", function () {
  beforeEach(async function () {
    [owner, otherAccount] = await ethers.getSigners();
    const Contract = await ethers.getContractFactory("MacroAlumniSBT");
    contract = await Contract.deploy()
  })

  it("Should support interfaces", async function () {
    expect(await contract.supportsInterface('0xb45a3c0e')).to.deep.equal(true)
    expect(await contract.supportsInterface('0x01ffc9a7')).to.deep.equal(true)
    expect(await contract.supportsInterface('0x80ac58cd')).to.deep.equal(true)
    expect(await contract.supportsInterface('0x5b5e139f')).to.deep.equal(true)
  });

  it("Should set the owner to be the deployer", async function () {
    expect(await contract.owner()).to.deep.equal(owner.address)
  })

  it("Should allow owner to set merkle root", async function () {
    generateMerkleTree()
    let mr = merkleTree.getHexRoot()
    await contract.setMerkleRoot(mr);
    expect(await contract.root()).to.deep.equal(mr)
  })

  it("Should allow alumni to mint", async function () {
    dataRaw[0].address = otherAccount.address
    const alumni = dataRaw[0]

    generateMerkleTree()
    await contract.setMerkleRoot(merkleTree.getHexRoot());

    const leaf = ethers.utils.solidityKeccak256(["address", "uint16", "uint8"], [alumni.address, alumni.blockNumber, alumni.graduationTier])
    const proof = merkleTree.getHexProof(leaf);

    await contract.connect(otherAccount).mint(alumni.blockNumber, alumni.graduationTier, proof)

    expect(await contract.ownerOf(0)).to.deep.equal((alumni.address))
    expect(await contract.addressToAlumniData(alumni.address)).to.deep.equal([true, false, 1, 3])
    expect(await contract.tokenIdToAlumniData(0)).to.deep.equal([true, false, 1, 3])
  })
  
  it("Should not allow non alumni to mint, even with a valid proof", async function () {
    
    dataRaw[0].address = otherAccount.address
    const alumni = dataRaw[0]
    
    generateMerkleTree()
    await contract.setMerkleRoot(merkleTree.getHexRoot());
    
    const leaf = ethers.utils.solidityKeccak256(["address", "uint16", "uint8"], [alumni.address, alumni.blockNumber, alumni.graduationTier])
    const proof = merkleTree.getHexProof(leaf);
    
    expect(contract.mint(alumni.blockNumber, alumni.graduationTier, proof)).to.be.revertedWith("INVALID_PROOF")
  })
  
  it("Should not allow an alumni to claim twice", async function () {
    await generateMerkleTreeAndMint();

    expect(await contract.ownerOf(0)).to.deep.equal((alumni.address))
    expect(await contract.addressToAlumniData(alumni.address)).to.deep.equal([true, false, 1, 3])
    expect(await contract.tokenIdToAlumniData(0)).to.deep.equal([true, false, 1, 3])
    
    expect(contract.connect(otherAccount).mint(alumni.blockNumber, alumni.graduationTier, proof)).to.be.revertedWith("CLAIMED")
    
  })
  
  it("Admin can burn tokens", async function () {
    await generateMerkleTreeAndMint();

    expect(await contract.ownerOf(0)).to.deep.equal((alumni.address))
    expect(await contract.addressToAlumniData(alumni.address)).to.deep.equal([true, false, 1, 3])
    expect(await contract.tokenIdToAlumniData(0)).to.deep.equal([true, false, 1, 3])

    expect(contract.connect(otherAccount).burn(0)).to.be.revertedWith("Ownable: caller is not the owner")
    
    await contract.burn(0)
    expect(await contract.balanceOf(alumni.address)).to.deep.equal(0)
    expect(await contract.addressToAlumniData(alumni.address)).to.deep.equal([true, true, 1, 3])
    expect(contract.tokenIdToAlumniData(0)).to.be.revertedWith("NOT_MINTED")
  })

  it("Alumni cannot mint token after their token has been burned", async function () {
    await generateMerkleTreeAndMint();

    await contract.burn(0)

    expect(contract.connect(otherAccount).mint(alumni.blockNumber, alumni.graduationTier, proof)).to.be.revertedWith("CLAIMED")
  })

  it("Tokens are locked and non-transferable", async function () {
    await generateMerkleTreeAndMint();
    
    expect(await contract.locked(0)).to.deep.equal(true);

    expect(contract.connect(otherAccount).transferFrom(otherAccount.address, owner.address, 0)).to.be.revertedWith("Ownable: caller is not the owner")
  })

  it("Admins can transfer tokens on behalf of alumni", async function () {
    await generateMerkleTreeAndMint();

    expect(await contract.locked(0)).to.deep.equal(true);

    await contract.transferFrom(otherAccount.address, owner.address, 0)
  })

  it("Should return the correct token URI", async function () {
    await generateMerkleTreeAndMint();

    await contract.setBaseURI("https://0xmacro.com/alumniSBT/")

    expect(await contract.tokenURI(0)).to.deep.equal("https://0xmacro.com/alumniSBT/0.json")
  })
})