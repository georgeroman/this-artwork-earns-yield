import { ethers } from "hardhat";

import type { ArtSteward } from "../typechain";

import { deployContract } from "../utils";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying to mainnet!!!");
  const artSteward: ArtSteward = await deployContract(
    "ArtSteward",
    deployer,
    "0xC983F7Bf9dB5b0ee7fF3f6d1B107F5Aa3DFa07cD"
  );
  console.log(artSteward.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
