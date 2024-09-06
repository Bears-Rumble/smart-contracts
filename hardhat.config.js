require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

task("checkWhitelist", "Checks if an address is whitelisted")
  .addParam("address", "The address to be checked")
  .setAction(async (taskArgs) => {
    const address = taskArgs.address;
    const contractAddress = "0x9C65942E9cF7f5f17A3b486E32E24Ea6D8A40FeA";

    // Get the contract with the factory
    const ICOContract = await hre.ethers.getContractFactory("ICO");
    const icoContract = ICOContract.attach(contractAddress);

    const isWhitelisted = await icoContract.whitelist(address);
    console.log(`Address ${address} is ` + (isWhitelisted ? "whitelisted" : "not whitelisted"));
  });

task("manageWhitelist", "Whitelists an address")
  .addParam("addresses", "The address to be whitelisted")
  .addParam("isWhitelisted", "Whether the address is whitelisted")
  .setAction(async (taskArgs) => {
    const addresses = taskArgs.addresses;
    const isWhitelisted = taskArgs.isWhitelisted;
    const contractAddress = "0x9C65942E9cF7f5f17A3b486E32E24Ea6D8A40FeA";

    // Get the contract with the factory
    const ICOContract = await hre.ethers.getContractFactory("ICO");
    const icoContract = ICOContract.attach(contractAddress);

    // Whitelist addresses
    await icoContract.manageWhitelist(addresses, isWhitelisted);

    console.log(`Done!`);
  });

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: "hardhat",
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  },
  networks: {
    hardhat: {
    },
    ethereum: {
      url: process.env.ETHEREUM_RPC_URL,
      accounts: [process.env.ETHEREUM_PRIVATE_KEY]
    },
    bnbTestnet: {
      url: process.env.BNB_TESTNET_RPC_URL,
      accounts: [process.env.BNB_TESTNET_PRIVATE_KEY]
    },
  },
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  }
};
