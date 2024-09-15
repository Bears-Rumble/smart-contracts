require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

task("checkWhitelist", "Checks if an address is whitelisted")
  .addParam("address", "The address to be checked")
  .setAction(async (taskArgs) => {
    const address = taskArgs.address;
    
    let contractAddress;
    if (hre.network.name === "ethereum") {
      contractAddress = process.env.ETHEREUM_ICO_CONTRACT_ADDRESS;
    } else if (hre.network.name === "bnbTestnet") {
      contractAddress = process.env.BNB_TESTNET_ICO_CONTRACT_ADDRESS;
    }

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
    let addresses = taskArgs.addresses;
    let isWhitelisted = taskArgs.isWhitelisted;
    
    let contractAddress;
    if (hre.network.name === "ethereum") {
      contractAddress = process.env.ETHEREUM_ICO_CONTRACT_ADDRESS;
    } else if (hre.network.name === "bnbTestnet") {
      contractAddress = process.env.BNB_TESTNET_ICO_CONTRACT_ADDRESS;
    }

    // Get the contract with the factory
    const ICOContract = await hre.ethers.getContractFactory("ICO");
    const icoContract = ICOContract.attach(contractAddress);
    console.log(`Managing whitelist for contract at address ${contractAddress}`);
    // Whitelist addresses
    const trx = await icoContract.manageWhitelist(["0x21C2b58eB7Fe8497fdb2864c50eA095621295738"], [true]);
    
    // Log the result
    console.log(trx);

    console.log(`Done!`);
  });

task("setWhitelistManager", "Sets a whitelist manager")
  .addParam("address", "The address to be added as a whitelist manager")
  .setAction(async (taskArgs) => {
    const address = taskArgs.address;
    
    let contractAddress;
    if (hre.network.name === "ethereum") {
      contractAddress = process.env.ETHEREUM_ICO_CONTRACT_ADDRESS;
    } else if (hre.network.name === "bnbTestnet") {
      contractAddress = process.env.BNB_TESTNET_ICO_CONTRACT_ADDRESS;
    }

    // Get the contract with the factory
    const ICOContract = await hre.ethers.getContractFactory("ICO");
    const icoContract = ICOContract.attach(contractAddress);

    const trx = await icoContract.setWhitelistManager(address);
    console.log(trx);
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
