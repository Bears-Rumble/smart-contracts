const hre = require("hardhat");

// Import the necessary dependencies

async function main() {
    // Get the contract verification helper from Hardhat
    const { run } = hre;

    // Specify the contract name and address
    const contractName = "contracts/BearRumble.sol:BearsRumble";
    const contractAddress = "0x377756bD580cd76B0DF15b8BbD93E05Ce55577D4";

    // Run the contract verification task
    await run("verify:verify", {
        address: contractAddress,
        contract: contractName,
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