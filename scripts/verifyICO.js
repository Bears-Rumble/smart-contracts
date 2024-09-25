const hre = require("hardhat");

// Import the necessary dependencies

async function main() {
    // Get the contract verification helper from Hardhat
    const { run } = hre;

    // Specify the contract name and address
    const contractName = "contracts/ICO.sol:ICO";
    const contractAddress = "0x4757e816098818c175c062f0796b15a986da0b05";

    // Run the contract verification task
    await run("verify:verify", {
        address: contractAddress,
        contract: contractName,
        network: "ethereum",
        constructorArguments: [
            "0x377756bD580cd76B0DF15b8BbD93E05Ce55577D4",
            [105600, 40000000000000000000000000n, 0, 20000000000000000000000n, 1729008000, 1734278400, 0, false, false],
            [52800, 50000000000000000000000000n, 0, 4000000000000000000000n, 1734451200, 1741968000, 0, false, false],
            [28820, 60000000000000000000000000n, 0, 0, 1743523200, 1751299200, 10922780000000000000000000n, false, false],
            7776000,
            25920000,
            40
        ]
    });
    console.log("Contract verification completed!");
}

// Execute the main function
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });