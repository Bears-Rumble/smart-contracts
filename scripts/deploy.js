const hre = require("hardhat");

async function main() {

  // Set deployment parameters (DUMMY VALUES, REPLACE WITH REAL VALUES)
  const saleOnePrice = 130_000; // Price in Tokens per Ether
  const saleOneSupply = 40_000_000n * 10n ** 18n;
  const saleOneMinPurchase = 130_000 * 10; //20_000n * 10n ** 18n; // About 500 USD  
  const saleOneStart = Math.round(Date.now() / 1000); // Now
  const saleOneEnd = saleOneStart + 60 * 60 * 24 * 2; // 4 days
  const saleOneMinTokensSold = 0; //140_000n * 10n ** 18n;

  const saleTwoPrice = 60_000; // Price in Tokens per Ether
  const saleTwoSupply = 50_000_000n * 10n ** 18n;
  const saleTwoMinPurchase = 60_000 * 10; //15_000n * 10n ** 18n; // About 200 USD
  const saleTwoStart = saleOneEnd + 60 * 60 * 24 ; // 1 days after SaleOne ends
  const saleTwoEnd = saleTwoStart + 60 * 60 * 24 * 2; // 3 days
  const saleTwoMinTokensSold = 70_000n * 10n ** 18n;

  const saleThreePrice = 30_000; // Price in Tokens per Ether
  const saleThreeSupply = 60_000_000n * 10n ** 18n;
  const saleThreeMinPurchase = 30_000 * 10;//10_000n * 10n ** 18n;
  const saleThreeStart = saleTwoEnd + 60 * 60 * 24 * 1; // 24 hours after SaleTwo ends
  const saleThreeEnd = saleThreeStart + 60 * 60 * 24 * 2; // 3 day
  const saleThreeMinTokensSold = 10_000_000n * 10n ** 18n;

  const cliffPeriod = 60 * 60 * 24 * 1; // 1 days
  const vestingPeriod = 60 * 60 * 24 * 10; // 10 days

  const saleTwo = [saleTwoPrice, saleTwoSupply, 0, saleTwoMinPurchase, saleTwoStart, saleTwoEnd, saleTwoMinTokensSold, false, false];
  const saleOne = [saleOnePrice, saleOneSupply, 0, saleOneMinPurchase, saleOneStart, saleOneEnd, saleOneMinTokensSold, false, false];
  const saleThree = [saleThreePrice, saleThreeSupply, 0, saleThreeMinPurchase, saleThreeStart, saleThreeEnd, saleThreeMinTokensSold, false, false];

  const referralRate = 40; // 1/40 = 2.5%

  // Deploy contracts
  let deployer;
  if (hre.network.name === "hardhat") {
    console.log("Deploying contracts to local network");
    deployer = (await hre.ethers.getSigners())[0];
  }
  [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const BearsRumbleToken = await hre.ethers.getContractFactory("BearsRumble");
  const bearsRumbleToken = await BearsRumbleToken.deploy();

  await bearsRumbleToken.waitForDeployment();

  console.log("BearsRumbleToken deployed to:", bearsRumbleToken.target);

  const BearsRumbleICO = await hre.ethers.getContractFactory("ICO");
  const bearsRumbleICO = await BearsRumbleICO.deploy(
    bearsRumbleToken.target,
    saleOne,
    saleTwo,
    saleThree,
    cliffPeriod,
    vestingPeriod,
    referralRate
  );

  await bearsRumbleICO.waitForDeployment();

  console.log("BearsRumbleICO deployed to:", bearsRumbleICO.target);

  // Transfer tokens to ICO contract
  await bearsRumbleToken.transfer(bearsRumbleICO.target, saleOneSupply + saleTwoSupply + saleThreeSupply);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
