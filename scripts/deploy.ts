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

function generateMerkleTree (): any {
  leaves = dataRaw.map((x) => ethers.utils.solidityKeccak256(["address", "uint16", "uint8"], [x.address, x.blockNumber, x.graduationTier]));
  merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
}


async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());
  generateMerkleTree()
  const Contract = await ethers.getContractFactory("MacroAlumniSBT");
  const contract = await Contract.deploy("ipfs://deadbeef/", merkleTree.getHexRoot(), deployer.address)

  console.log(`deployed ${contract.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
