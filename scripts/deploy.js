const hre = require("hardhat");

async function main() {

  // Set deployment parameters (DUMMY VALUES, REPLACE WITH REAL VALUES)
  const saleOnePrice = 130_000; // Price in Tokens per Ether
  const saleOneSupply = 40_000_000n * 10n ** 18n;
  const saleOneMinPurchase = 20_000n * 10n ** 18n; // About 500 USD  
  const saleOneStart = Math.round(Date.now() / 1000) + 60 * 60 * 24 * 7; // 7 days from now
  const saleOneEnd = saleOneStart + 60 * 60 * 24 * 30; // 30 days
  const saleOneMinTokensSold = 140_000n * 10n ** 18n;

  const saleTwoPrice = 60_000; // Price in Tokens per Ether
  const saleTwoSupply = 50_000_000n * 10n ** 18n;
  const saleTwoMinPurchase = 15_000n * 10n ** 18n; // About 200 USD
  const saleTwoStart = saleOneEnd + 60 * 60 * 24 * 60; // 60 days after SaleOne ends
  const saleTwoEnd = saleTwoStart + 60 * 60 * 24 * 30; // 30 days
  const saleTwoMinTokensSold = 70_000n * 10n ** 18n;

  const saleThreePrice = 30_000; // Price in Tokens per Ether
  const saleThreeSupply = 60_000_000n * 10n ** 18n;
  const saleThreeMinPurchase = 10_000n * 10n ** 18n;
  const saleThreeStart = saleTwoEnd + 60 * 60 * 24 * 60; // 30 days after SaleTwo ends
  const saleThreeEnd = saleThreeStart + 60 * 60 * 24 * 30; // 30 days
  const saleThreeMinTokensSold = 10_000_000n * 10n ** 18n;

  const cliffPeriod = 60 * 60 * 24 * 30; // 30 days
  const vestingPeriod = 60 * 60 * 24 * 300; // 300 days

  const saleTwo = [saleTwoPrice, saleTwoSupply, 0, saleTwoMinPurchase, saleTwoStart, saleTwoEnd, saleTwoMinTokensSold, false, false];
  const saleOne = [saleOnePrice, saleOneSupply, 0, saleOneMinPurchase, saleOneStart, saleOneEnd, saleOneMinTokensSold, false, false];
  const saleThree = [saleThreePrice, saleThreeSupply, 0, saleThreeMinPurchase, saleThreeStart, saleThreeEnd, saleThreeMinTokensSold, false, false];

  // Deploy contracts
  let deployer;
  if (hre.network.name === "hardhat") {
    console.log("Deploying contracts to local network");
    deployer = (await hre.ethers.getSigners())[0];
  }
  [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const BearRumbleToken = await hre.ethers.getContractFactory("BearRumble");
  const bearRumbleToken = await BearRumbleToken.deploy();

  await bearRumbleToken.waitForDeployment();

  console.log("BearRumbleToken deployed to:", bearRumbleToken.target);

  const BearRumbleICO = await hre.ethers.getContractFactory("ICO");
  const bearRumbleICO = await BearRumbleICO.deploy(
    bearRumbleToken.target,
    saleOne,
    saleTwo,
    saleThree,
    cliffPeriod,
    vestingPeriod
  );

  await bearRumbleICO.waitForDeployment();

  console.log("BearRumbleICO deployed to:", bearRumbleICO.target);

  // Transfer tokens to ICO contract
  await bearRumbleToken.transfer(bearRumbleICO.target, saleOneSupply + saleTwoSupply + saleThreeSupply);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
