import { BigNumber } from "@ethersproject/bignumber";
import { ethers, network } from "hardhat";

import type { ArtSteward, ERC20, TAEY } from "../typechain";

const YVWETHV2_ADDRESS = "0xa9fE4601811213c340e850ea305481afF02f5b28";
const STRATEGIST_ADDRESS = "0xC3D6880fD95E06C816cB030fAc45b3ffe3651Cb0";

// Retrieves the current timestamp on the blockchain
export const now = async (): Promise<number> => {
  const latestBlock = await ethers.provider.getBlock("latest");
  return latestBlock.timestamp;
};

// Mine a block at a given timestamp
const mineBlock = async (timestamp: number) =>
  await ethers.provider.send("evm_increaseTime", [timestamp]);

const harvest = async () => {
  const strategist = ethers.provider.getSigner(STRATEGIST_ADDRESS);
  await strategist
    .sendTransaction({
      to: "0xeE697232DF2226c9fB3F02a57062c4208f287851",
      data: new ethers.utils.Interface(["function harvest()"]).encodeFunctionData("harvest"),
    })
    .then((tx) => tx.wait());
};

const getPricePerShare = async (): Promise<BigNumber> => {
  const iface = new ethers.utils.Interface(["function pricePerShare() returns (uint256)"]);

  let rawPricePerShare = await ethers.provider.call({
    to: YVWETHV2_ADDRESS,
    data: iface.encodeFunctionData("pricePerShare"),
  });

  return ethers.BigNumber.from(
    iface.decodeFunctionResult("pricePerShare", rawPricePerShare).toString()
  );
};

async function main() {
  const [account] = await ethers.getSigners();

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [STRATEGIST_ADDRESS],
  });

  const taeyFactory = await ethers.getContractFactory("TAEY", account);
  const taey = (await taeyFactory.deploy().then((contract) => contract.deployed())) as TAEY;

  const artStewardFactory = await ethers.getContractFactory("ArtSteward", account);
  const artSteward = (await artStewardFactory
    .deploy(taey.address, account.address)
    .then((contract) => contract.deployed())) as ArtSteward;

  const yvwETHv2 = (await ethers.getContractFactory("ERC20", account)).attach(
    YVWETHV2_ADDRESS
  ) as ERC20;

  console.log(
    (await yvwETHv2.balanceOf(artSteward.address))
      .mul("1000000000000000000")
      .div(await getPricePerShare())
      .toString()
  );

  const newSellPrice = ethers.BigNumber.from("10000000000000000000");
  await artSteward
    .connect(account)
    .buy(newSellPrice, { value: newSellPrice })
    .then((tx) => tx.wait());

  console.log(
    (await yvwETHv2.balanceOf(artSteward.address))
      .mul("1000000000000000000")
      .div(await getPricePerShare())
      .toString()
  );

  await mineBlock((await now()) + 10 * 24 * 3600);
  await harvest();

  console.log(
    (await yvwETHv2.balanceOf(artSteward.address))
      .mul("1000000000000000000")
      .div(await getPricePerShare())
      .toString()
  );

  await mineBlock((await now()) + 100 * 24 * 3600);
  await harvest();

  console.log(
    (await yvwETHv2.balanceOf(artSteward.address))
      .mul("1000000000000000000")
      .div(await getPricePerShare())
      .toString()
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
