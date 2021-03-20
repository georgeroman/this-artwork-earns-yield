import { BigNumber } from "@ethersproject/bignumber";
import { providers } from "ethers";
import { ethers, network } from "hardhat";

import type { ArtSteward, ERC20, TAEY } from "../typechain";

// Retrieves the current timestamp on the blockchain
export const now = async (): Promise<number> => {
  const latestBlock = await ethers.provider.getBlock("latest");
  return latestBlock.timestamp;
};

// Mine a block at a given timestamp
const mineBlock = async (timestamp: number) =>
  await ethers.provider.send("evm_increaseTime", [timestamp]);

async function main() {
  const [account] = await ethers.getSigners();

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: ["0xC3D6880fD95E06C816cB030fAc45b3ffe3651Cb0"],
  });
  const strategist = ethers.provider.getSigner("0xC3D6880fD95E06C816cB030fAc45b3ffe3651Cb0");

  const taeyFactory = await ethers.getContractFactory("TAEY", account);
  const taey = (await taeyFactory.deploy().then((contract) => contract.deployed())) as TAEY;

  const artStewardFactory = await ethers.getContractFactory("ArtSteward", account);
  const artSteward = (await artStewardFactory
    .deploy(taey.address, account.address)
    .then((contract) => contract.deployed())) as ArtSteward;

  await strategist
    .sendTransaction({
      to: "0xeE697232DF2226c9fB3F02a57062c4208f287851",
      data: new ethers.utils.Interface(["function harvest()"]).encodeFunctionData("harvest"),
    })
    .then((tx) => tx.wait());

  const amountDeposited = ethers.BigNumber.from("10000000000000000000");

  await artSteward
    .connect(account)
    .buy(amountDeposited, { value: amountDeposited })
    .then((tx) => tx.wait());

  const ywETHv2 = (await ethers.getContractFactory("ERC20", account)).attach(
    "0xa9fE4601811213c340e850ea305481afF02f5b28"
  ) as ERC20;

  const iface = new ethers.utils.Interface(["function pricePerShare() returns (uint256)"]);

  let rawPricePerShare = await account.call({
    to: ywETHv2.address,
    data: iface.encodeFunctionData("pricePerShare"),
  });

  let pricePerShare = ethers.BigNumber.from(
    iface.decodeFunctionResult("pricePerShare", rawPricePerShare).toString()
  );
  console.log("old pricePerShare", pricePerShare.toString());

  console.log(
    (await ywETHv2.balanceOf(artSteward.address))
      .mul("1000000000000000000")
      .div(pricePerShare)
      .toString()
  );

  await mineBlock((await now()) + 10 * 24 * 3600);

  await strategist
    .sendTransaction({
      to: "0xeE697232DF2226c9fB3F02a57062c4208f287851",
      data: new ethers.utils.Interface(["function harvest()"]).encodeFunctionData("harvest"),
      gasLimit: 9500000,
    })
    .then((tx) => tx.wait());

  rawPricePerShare = await account.call({
    to: ywETHv2.address,
    data: iface.encodeFunctionData("pricePerShare"),
  });

  pricePerShare = ethers.BigNumber.from(
    iface.decodeFunctionResult("pricePerShare", rawPricePerShare).toString()
  );
  console.log("new pricePerShare", pricePerShare.toString());

  console.log(
    (await ywETHv2.balanceOf(artSteward.address))
      .mul("1000000000000000000")
      .div(pricePerShare)
      .toString()
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
