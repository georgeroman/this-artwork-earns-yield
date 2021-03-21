import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";

import type { ArtSteward, WETH9, YvwETHv2 } from "../typechain";

import { bn, deployContract, e18 } from "../utils";

chai.use(solidity);
const { expect } = chai;

describe("ArtSteward", () => {
  let deployer: SignerWithAddress;
  let artist: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let wETH9: WETH9;
  let yvwETHv2: YvwETHv2;
  let artSteward: ArtSteward;

  beforeEach(async () => {
    [deployer, artist, alice, bob] = await ethers.getSigners();

    wETH9 = await deployContract("wETH9", deployer);
    yvwETHv2 = await deployContract("yvwETHv2", deployer, wETH9.address);
    artSteward = await deployContract("ArtSteward", deployer, artist.address);

    await artSteward.connect(deployer).setWETH9(wETH9.address);
    await artSteward.connect(deployer).setYvwETHv2(yvwETHv2.address);

    // Transfer wETH to the yEarn vault to mimick earning yield
    const yieldETH = e18(10);
    await wETH9.connect(deployer).deposit({ value: yieldETH });
    await wETH9.connect(deployer).transfer(yvwETHv2.address, yieldETH);
  });

  const buyArt = async (signer: SignerWithAddress, newSellPrice: BigNumber) => {
    const sellPrice = await artSteward.sellPrice();
    const deposit = newSellPrice.sub(sellPrice).gt(bn(0)) ? newSellPrice.sub(sellPrice) : bn(0);
    await artSteward.connect(alice).buy(newSellPrice, { value: deposit });
  };

  const ethToShares = async (eth: BigNumber): Promise<BigNumber> => {
    return eth.mul(e18(1)).div(await yvwETHv2.pricePerShare());
  };

  const sharesToEth = async (shares: BigNumber): Promise<BigNumber> => {
    return shares.mul(await yvwETHv2.pricePerShare()).div(e18(1));
  };

  describe("buy", () => {
    it("initial buy", async () => {
      await artSteward.connect(alice).buy(e18(1), { value: e18(1) });
      expect(await artSteward.owner()).to.eq(alice.address);
      expect(await artSteward.purchasePrice()).to.eq(bn(0));
      expect(await artSteward.sellPrice()).to.eq(e18(1));
      expect(await yvwETHv2.balanceOf(artSteward.address)).to.eq(await ethToShares(e18(1)));
    });

    it("buy from previous owner", async () => {
      await artSteward.connect(alice).buy(e18(1), { value: e18(1) });

      const ownerBalance1 = await alice.getBalance();
      const artistBalance1 = await artist.getBalance();

      await artSteward.connect(bob).buy(e18(3), { value: e18(3) });

      const ownerSellShare = e18(1).mul(95).div(100);
      const artistSellShare = e18(1).sub(ownerSellShare);

      expect(await yvwETHv2.balanceOf(artSteward.address)).to.eq(await ethToShares(e18(2)));
      expect(await alice.getBalance()).to.eq(ownerBalance1.add(e18(1)).add(ownerSellShare));
      expect(await artist.getBalance()).to.eq(artistBalance1.add(artistSellShare));
    });

    it("buy and set a sell price lower than the purchase price", async () => {
      await artSteward.connect(alice).buy(e18(2), { value: e18(2) });

      const ownerBalance1 = await alice.getBalance();

      await artSteward.connect(bob).buy(e18(0), { value: e18(2) });

      const ownerSellShare = e18(2).mul(95).div(100);

      expect(await yvwETHv2.balanceOf(artSteward.address)).to.eq(bn(0));
      expect(await alice.getBalance()).to.eq(ownerBalance1.add(e18(2)).add(ownerSellShare));
    });
  });

  describe("set price", () => {
    it("set a higher price", async () => {
      await artSteward.connect(alice).buy(e18(1), { value: e18(1) });
      await artSteward.connect(alice).setPrice(e18(2), { value: e18(1) });
      expect(await yvwETHv2.balanceOf(artSteward.address)).to.eq(await ethToShares(e18(2)));
    });

    it("set a lower price", async () => {
      await artSteward.connect(alice).buy(e18(2), { value: e18(2) });
      await artSteward.connect(alice).setPrice(e18(1));
      expect(await yvwETHv2.balanceOf(artSteward.address)).to.eq(await ethToShares(e18(1)));
    });
  });

  describe("earn yield", async () => {
    it("positive yield", async () => {
      await artSteward.connect(alice).buy(e18(10), { value: e18(10) });

      await yvwETHv2.connect(deployer).setPricePerShare(e18(101).div(100));

      const depositShares = e18(10)
        .mul(e18(1))
        .div(await yvwETHv2.pricePerShare());
      const totalShares = await yvwETHv2.balanceOf(artSteward.address);
      const _yield = totalShares
        .sub(depositShares)
        .mul(await yvwETHv2.pricePerShare())
        .div(e18(1));

      const ownerBalance1 = await alice.getBalance();
      const artistBalance1 = await artist.getBalance();

      const tx = await artSteward.connect(alice).collectYield();
      const ethUsedAsGas = tx.gasPrice.mul((await tx.wait()).gasUsed);

      expect(await alice.getBalance()).to.eq(ownerBalance1.sub(ethUsedAsGas).add(_yield.div(2)));
      expect(await artist.getBalance()).to.eq(artistBalance1.add(_yield.sub(_yield.div(2))));
    });

    it("negative yield", async () => {
      await artSteward.connect(alice).buy(e18(10), { value: e18(10) });

      const sharesValue1 = await sharesToEth(await yvwETHv2.balanceOf(artSteward.address));
      await yvwETHv2.connect(deployer).setPricePerShare(e18(99).div(100));
      const sharesValue2 = await sharesToEth(await yvwETHv2.balanceOf(artSteward.address));

      const depositShares = e18(10)
        .mul(e18(1))
        .div(await yvwETHv2.pricePerShare());
      const totalShares = await yvwETHv2.balanceOf(artSteward.address);

      // On a negative yield, the yEarn shares are worth less than the deposit
      expect(depositShares.gt(totalShares)).to.be.true;

      const ownerBalance1 = await alice.getBalance();
      const artistBalance1 = await artist.getBalance();

      // Consequently, no yield is generated as all shares would be used to cover the deposit
      const tx = await artSteward.connect(alice).collectYield();
      const ethUsedAsGas = tx.gasPrice.mul((await tx.wait()).gasUsed);

      expect(await alice.getBalance()).to.eq(ownerBalance1.sub(ethUsedAsGas));
      expect(await artist.getBalance()).to.eq(artistBalance1);
    });
  });
});
