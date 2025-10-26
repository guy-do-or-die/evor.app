import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import hardhatVerify from "@nomicfoundation/hardhat-verify";
import "dotenv/config";

const config: HardhatUserConfig = {
  plugins: [hardhatVerify],
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    base: {
      type: "http",
      url: process.env.BASE_RPC || "https://mainnet.base.org",
      accounts: process.env.DEMO_EOA_PK ? [process.env.DEMO_EOA_PK] : [],
      chainId: 8453,
    },
    baseSepolia: {
      type: "http",
      url: process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org",
      accounts: process.env.DEMO_EOA_PK ? [process.env.DEMO_EOA_PK] : [],
      chainId: 84532,
    },
    sepolia: {
      type: "http",
      url: process.env.SEPOLIA_RPC || "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: process.env.DEMO_EOA_PK ? [process.env.DEMO_EOA_PK] : [],
      chainId: 11155111,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  verify: {
    etherscan: {
      apiKey: "QU7HJKEPS3D6AYFBVCPIBEA78UUN53D91A",
    },
  },
};

export default config;
