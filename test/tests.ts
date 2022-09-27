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

let merkleTree: any, leaves: any

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
    
        dataRaw[0].address = otherAccount.address
        const alumni = dataRaw[0]
    
        generateMerkleTree()
        await contract.setMerkleRoot(merkleTree.getHexRoot());
    
        const leaf = ethers.utils.solidityKeccak256(["address", "uint16", "uint8"], [alumni.address, alumni.blockNumber, alumni.graduationTier])
        const proof = merkleTree.getHexProof(leaf);
    
        await contract.connect(otherAccount).mint(alumni.blockNumber, alumni.graduationTier, proof)
        
        expect(contract.mint(alumni.blockNumber, alumni.graduationTier, proof)).to.be.revertedWith("CLAIMED")
    
  })

  it("", async function () {

  })
})

// // We define a fixture to reuse the same setup in every test.
// // We use loadFixture to run this setup once, snapshot that state,
// // and reset Hardhat Network to that snapshot in every test.
// async function deployOneYearLockFixture() {
//   const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
//   const ONE_GWEI = 1_000_000_000;

//   const lockedAmount = ONE_GWEI;
//   const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;

//   // Contracts are deployed using the first signer/account by default
//   const [owner, otherAccount] = await ethers.getSigners();

//   const Lock = await ethers.getContractFactory("Lock");
//   const lock = await Lock.deploy(unlockTime, { value: lockedAmount });

//   return { lock, unlockTime, lockedAmount, owner, otherAccount };
// }

// describe("Deployment", function () {
//   it("Should set the right unlockTime", async function () {
//     const { lock, unlockTime } = await loadFixture(deployOneYearLockFixture);

//     expect(await lock.unlockTime()).to.equal(unlockTime);
//   });

//   it("Should set the right owner", async function () {
//     const { lock, owner } = await loadFixture(deployOneYearLockFixture);

//     expect(await lock.owner()).to.equal(owner.address);
//   });

//   it("Should receive and store the funds to lock", async function () {
//     const { lock, lockedAmount } = await loadFixture(
//       deployOneYearLockFixture
//     );

//     expect(await ethers.provider.getBalance(lock.address)).to.equal(
//       lockedAmount
//     );
//   });

//   it("Should fail if the unlockTime is not in the future", async function () {
//     // We don't use the fixture here because we want a different deployment
//     const latestTime = await time.latest();
//     const Lock = await ethers.getContractFactory("Lock");
//     await expect(Lock.deploy(latestTime, { value: 1 })).to.be.revertedWith(
//       "Unlock time should be in the future"
//     );
//   });
// });

// describe("Withdrawals", function () {
//   describe("Validations", function () {
//     it("Should revert with the right error if called too soon", async function () {
//       const { lock } = await loadFixture(deployOneYearLockFixture);

//       await expect(lock.withdraw()).to.be.revertedWith(
//         "You can't withdraw yet"
//       );
//     });

//     it("Should revert with the right error if called from another account", async function () {
//       const { lock, unlockTime, otherAccount } = await loadFixture(
//         deployOneYearLockFixture
//       );

//       // We can increase the time in Hardhat Network
//       await time.increaseTo(unlockTime);

//       // We use lock.connect() to send a transaction from another account
//       await expect(lock.connect(otherAccount).withdraw()).to.be.revertedWith(
//         "You aren't the owner"
//       );
//     });

//     it("Shouldn't fail if the unlockTime has arrived and the owner calls it", async function () {
//       const { lock, unlockTime } = await loadFixture(
//         deployOneYearLockFixture
//       );

//       // Transactions are sent using the first signer by default
//       await time.increaseTo(unlockTime);

//       await expect(lock.withdraw()).not.to.be.reverted;
//     });
//   });

//   describe("Events", function () {
//     it("Should emit an event on withdrawals", async function () {
//       const { lock, unlockTime, lockedAmount } = await loadFixture(
//         deployOneYearLockFixture
//       );

//       await time.increaseTo(unlockTime);

//       await expect(lock.withdraw())
//         .to.emit(lock, "Withdrawal")
//         .withArgs(lockedAmount, anyValue); // We accept any value as `when` arg
//     });
//   });

//   describe("Transfers", function () {
//     it("Should transfer the funds to the owner", async function () {
//       const { lock, unlockTime, lockedAmount, owner } = await loadFixture(
//         deployOneYearLockFixture
//       );

//       await time.increaseTo(unlockTime);

//       await expect(lock.withdraw()).to.changeEtherBalances(
//         [owner, lock],
//         [lockedAmount, -lockedAmount]
//       );
//     });
//   });
// });