import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-gas-reporter";
import "solidity-coverage";
require("dotenv").config({ path: __dirname + '/.env' })

const config: HardhatUserConfig = {
  solidity: "0.8.17",
  gasReporter: {
    enabled: (process.env.REPORT_GAS) ? true : false
  }
};

export default config;
