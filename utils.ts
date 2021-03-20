import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber, BigNumberish, Contract } from "ethers";
import { ethers } from "hardhat";

export const deployContract = async <T extends Contract>(
  name: string,
  deployer: SignerWithAddress,
  ...args: any[]
): Promise<T> => {
  const contractFactory = await ethers.getContractFactory(name, deployer);
  const contractInstance = await contractFactory.deploy(...args);
  return (await contractInstance.deployed()) as T;
};

export const bn = (n: BigNumberish): BigNumber => BigNumber.from(n);

export const expandTo18Decimals = (n: BigNumberish): BigNumber =>
  ethers.BigNumber.from(n).mul(ethers.BigNumber.from(10).pow(18));
