import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";

import type { ArtSteward, WETH9, YvwETHv2 } from "../typechain";

import { bn, deployContract, expandTo18Decimals } from "../utils";

chai.use(solidity);
const { expect } = chai;

describe("ArtSteward", () => {
  let deployer: SignerWithAddress;
  let artist: SignerWithAddress;
  let alice: SignerWithAddress;

  let wETH9: WETH9;
  let yvwETHv2: YvwETHv2;
  let artSteward: ArtSteward;

  beforeEach(async () => {
    [deployer, artist, alice] = await ethers.getSigners();

    wETH9 = await deployContract("wETH9", deployer);
    yvwETHv2 = await deployContract("yvwETHv2", deployer, wETH9.address);
    artSteward = await deployContract("ArtSteward", deployer, artist.address);

    await artSteward.connect(deployer).setWETH9(wETH9.address);
    await artSteward.connect(deployer).setYvwETHv2(yvwETHv2.address);

    // Transfer wETH to the yEarn vault to mimick earning yield
    const yieldETH = expandTo18Decimals(10);
    await wETH9.connect(deployer).deposit({ value: yieldETH });
    await wETH9.connect(deployer).transfer(yvwETHv2.address, yieldETH);
  });

  it("initial buy", async () => {
    const oldSellPrice = bn(0);
    const newSellPrice = expandTo18Decimals(1);
    await artSteward.connect(alice).buy(newSellPrice, { value: newSellPrice.sub(oldSellPrice) });
    expect(await artSteward.owner()).to.eq(alice.address);
  });
});
