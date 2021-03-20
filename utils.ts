import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Contract } from "ethers";
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
