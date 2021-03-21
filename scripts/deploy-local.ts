import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers } from "hardhat";

import type { ArtSteward, WETH9, YvwETHv2 } from "../typechain";

import { deployContract, e18 } from "../utils";

let deployer: SignerWithAddress;
let artist: SignerWithAddress;
let alice: SignerWithAddress;
let bob: SignerWithAddress;

let wETH9: WETH9;
let yvwETHv2: YvwETHv2;
let artSteward: ArtSteward;

async function main() {
  [deployer, artist] = await ethers.getSigners();

  // wETH9 = await deployContract("wETH9", deployer);
  // yvwETHv2 = await deployContract("yvwETHv2", deployer, wETH9.address);
  // artSteward = await deployContract("ArtSteward", deployer, artist.address);

  // console.log(artSteward.address);
  // console.log(yvwETHv2.address);

  // await artSteward.connect(deployer).setWETH9(wETH9.address);
  // await artSteward.connect(deployer).setYvwETHv2(yvwETHv2.address);

  // // Transfer wETH to the yEarn vault to mimick earning yield
  // const yieldETH = e18(1);
  // await wETH9.connect(deployer).deposit({ value: yieldETH });
  // await wETH9.connect(deployer).transfer(yvwETHv2.address, yieldETH);

  yvwETHv2 = (await ethers.getContractFactory("yvwETHv2", deployer)).attach(
    "0xAb7d14d6c36AAe3671e33d23bb46679A8615690b"
  ) as YvwETHv2;
  artSteward = (await ethers.getContractFactory("ArtSteward", deployer)).attach(
    "0x4617C9fB73600DC2e5299fE8d01e7b2be34d344D"
  ) as ArtSteward;
  await yvwETHv2
    .connect(deployer)
    .setPricePerShare(e18(106).div(100))
    .then((tx) => tx.wait());
  console.log((await yvwETHv2.pricePerShare()).toString());
  console.log((await artSteward.getCurrentYield()).toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
