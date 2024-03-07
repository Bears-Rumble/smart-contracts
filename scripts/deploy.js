const hre = require("hardhat");

async function main() {

  // Set deployment parameters (DUMMY VALUES, REPLACE WITH REAL VALUES)
  const saleOnePrice = 1000;
  const saleTwoPrice = 2000;
  const saleOneSupply = 100_000_000n * 10n ** 18n;
  const saleTwoSupply = 200_000_000n * 10n ** 18n;
  const saleOneStart = Math.round(Date.now() / 1000) + 60 * 60 * 24 * 7; // 7 days from now
  const saleOneEnd = saleOneStart + 60 * 60 * 24 * 7; // 7 days
  const saleTwoStart = saleOneEnd + 60 * 60 * 24 * 7; // 7 days after SaleOne ends
  const saleTwoEnd = saleTwoStart + 60 * 60 * 24 * 7; // 7 days
  const cliffPeriod = 60 * 60 * 24 * 30; // 30 days
  const vestingPeriod = 60 * 60 * 24 * 180; // 180 days

  // Deploy contracts
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const BearRumbleToken = await hre.ethers.getContractFactory("BearRumble");
  const bearRumbleToken = await BearRumbleToken.deploy();

  await bearRumbleToken.waitForDeployment();

  console.log("BearRumbleToken deployed to:", bearRumbleToken.target);

  const BearRumbleICO = await hre.ethers.getContractFactory("ICO");
  const bearRumbleICO = await BearRumbleICO.deploy(
    bearRumbleToken.target,
    saleOnePrice,
    saleTwoPrice,
    saleOneSupply,
    saleTwoSupply,
    saleOneStart,
    saleOneEnd,
    saleTwoStart,
    saleTwoEnd,
    cliffPeriod,
    vestingPeriod
  );

  await bearRumbleICO.waitForDeployment();

  console.log("BearRumbleICO deployed to:", bearRumbleICO.target);

  // Transfer tokens to ICO contract
  await bearRumbleToken.transfer(bearRumbleICO.target, saleOneSupply + saleTwoSupply);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
