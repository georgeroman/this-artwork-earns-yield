import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";

import type { ArtSteward, WETH9, YvwETHv2 } from "../typechain";

import { deployContract } from "../utils";

chai.use(solidity);
const { expect } = chai;

describe("ArtSteward", () => {
  let deployer: SignerWithAddress;
  let artist: SignerWithAddress;

  let wETH9: WETH9;
  let yvwETHv2: YvwETHv2;
  let artSteward: ArtSteward;

  beforeEach(async () => {
    [deployer, artist] = await ethers.getSigners();

    wETH9 = await deployContract("wETH9", deployer);
    yvwETHv2 = await deployContract("yvwETHv2", deployer, wETH9.address);
    artSteward = await deployContract("ArtSteward", deployer, artist.address);

    await artSteward.connect(deployer).setWETH9(wETH9.address);
    await artSteward.connect(deployer).setYvwETHv2(yvwETHv2.address);

    // Transfer wETH to the yEarn vault to mimick earning yield
    const yieldETH = ethers.BigNumber.from("10000000000000000000");
    await wETH9.connect(deployer).deposit({ value: yieldETH });
    await wETH9.connect(deployer).transfer(yvwETHv2.address, yieldETH);
  });

  it("foo", async () => {});
});
