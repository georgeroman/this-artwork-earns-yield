import { ethers } from "hardhat";

import type { ArtSteward, ERC20, NFT } from "../typechain";

async function main() {
  const [account] = await ethers.getSigners();

  const nftFactory = await ethers.getContractFactory("NFT", account);
  const nft = (await nftFactory.deploy().then((contract) => contract.deployed())) as NFT;

  const artStewardFactory = await ethers.getContractFactory("ArtSteward", account);
  const artSteward = (await artStewardFactory
    .deploy(account.address, nft.address)
    .then((contract) => contract.deployed())) as ArtSteward;

  const amountDeposited = ethers.BigNumber.from("10000000000000000000");

  await artSteward
    .connect(account)
    .deposit({ value: amountDeposited })
    .then((tx) => tx.wait());

  const ywETHV2 = (await ethers.getContractFactory("ERC20", account)).attach(
    "0xa9fE4601811213c340e850ea305481afF02f5b28"
  ) as ERC20;

  const iface = new ethers.utils.Interface(["function pricePerShare() returns (uint256)"]);

  const rawPricePerShare = await account.call({
    to: ywETHV2.address,
    data: iface.encodeFunctionData("pricePerShare"),
  });
  const pricePerShare = ethers.BigNumber.from(
    iface.decodeFunctionResult("pricePerShare", rawPricePerShare).toString()
  );
  console.log(pricePerShare.toString());

  console.log(ethers.utils.formatEther(await ywETHV2.balanceOf(artSteward.address)));
  console.log(amountDeposited.div(pricePerShare).toString());

  console.log((await account.getBalance()).toString());

  await artSteward
    .connect(account)
    .withdraw(amountDeposited)
    .then((tx) => tx.wait());

  console.log((await account.getBalance()).toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
