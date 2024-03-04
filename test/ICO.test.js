const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("ICO Contract", function () {
    let ICO, BearRumble, ico, bearRumble, owner, addr1, addr2;

    // Set deployment parameters
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

    beforeEach(async function () {

        // Deploy contracts
        ICO = await ethers.getContractFactory("ICO");
        BearRumble = await ethers.getContractFactory("BearRumble");

        bearRumble = await BearRumble.deploy();
        await bearRumble.waitForDeployment();

        ico = await ICO.deploy(bearRumble.target,
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
        await ico.waitForDeployment();
        // Get signers
        [owner, addr1, addr2] = await ethers.getSigners();
    });

    describe.only("Deployment", function () {
        it("Should set the correct parameters", async function () {
            expect(await ico.token).to.equal(bearRumble.address);
            expect(await ico.saleOnePrice()).to.equal(saleOnePrice);
            expect(await ico.saleTwoPrice()).to.equal(saleTwoPrice);
            expect(await ico.saleOneTokenSupply()).to.equal(saleOneSupply);
            expect(await ico.saleTwoTokenSupply()).to.equal(saleTwoSupply);
            expect(await ico.saleOneStartTime()).to.equal(saleOneStart);
            expect(await ico.saleOneEndTime()).to.equal(saleOneEnd);
            expect(await ico.saleTwoStartTime()).to.equal(saleTwoStart);
            expect(await ico.saleTwoEndTime()).to.equal(saleTwoEnd);
            expect(await ico.cliffPeriod()).to.equal(cliffPeriod);
            expect(await ico.vestingPeriod()).to.equal(vestingPeriod);
        });

        // Add more tests for deployment checks
    });

    describe("Sale stages", function () {
        it("Should set the correct sale stage", async function () {
            // Test sale stages by manipulating the block timestamp
            await expect(ico.saleStage()).to.eventually.equal(ico.SaleStage.BeforeStart);

            // Set the timestamp to be within SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [/* Set a timestamp within SaleOne */]);
            await expect(ico.saleStage()).to.eventually.equal(ico.SaleStage.SaleOne);

            // Set the timestamp to be within SaleTwo
            await ethers.provider.send("evm_setNextBlockTimestamp", [/* Set a timestamp within SaleTwo */]);
            await expect(ico.saleStage()).to.eventually.equal(ico.SaleStage.SaleTwo);

            // Set the timestamp to be after the sales have ended
            await ethers.provider.send("evm_setNextBlockTimestamp", [/* Set a timestamp after the sales have ended */]);
            await expect(ico.saleStage()).to.eventually.equal(ico.SaleStage.Ended);
        });
    });

    describe("Whitelisting", function () {
        it("Should add an address to the whitelist", async function () {
            // Add addr1 to the whitelist
            await ico.addToWhitelist([addr1.address]);

            // Check if addr1 is whitelisted
            expect(await ico.whitelist(addr1.address)).to.be.true;
        });
    });

    describe("Buying tokens", function () {
        it("Should buy tokens during SaleOne", async function () {
            // Set the timestamp to be within SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [/* Set a timestamp within SaleOne */]);

            // Add addr1 to the whitelist
            await ico.addToWhitelist([addr1.address]);

            // Buy tokens with addr1
            const tokenAmount = ethers.utils.parseEther("1");
            const tx = await ico.connect(addr1).buyTokens(tokenAmount, { value: ethers.utils.parseEther("1") });
            await tx.wait();

            // Check if the tokens were bought correctly
            expect(await ico.boughtTokens(addr1.address)).to.equal(tokenAmount);
        });
    });

    describe("Claiming tokens", function () {
        it("Should claim tokens after the sale has ended", async function () {
            // Set the timestamp to be within SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [/* Set a timestamp within SaleOne */]);

            // Add addr1 to the whitelist
            await ico.addToWhitelist([addr1.address]);

            // Buy tokens with addr1
            const tokenAmount = ethers.utils.parseEther("1");
            const tx = await ico.connect(addr1).buyTokens(tokenAmount, { value: ethers.utils.parseEther("1") });
            await tx.wait();

            // Set the timestamp to be after the cliff period and within the vesting period
            await ethers.provider.send("evm_setNextBlockTimestamp", [/* Set a timestamp after the cliff period and within the vesting period */]);

            // Claim tokens with addr1
            const initialBalance = await bearRumble.balanceOf(addr1.address);
            await ico.connect(addr1).claimTokens();
            const finalBalance = await bearRumble.balanceOf(addr1.address);

            // Check if the tokens were claimed correctly
            expect(finalBalance).to.be.gt(initialBalance);
        });
    });

    describe("Burning unsold tokens", function () {
        it("Should burn unsold tokens after the sale has ended", async function () {
            // Set the timestamp to be after the sales have ended
            await ethers.provider.send("evm_setNextBlockTimestamp", [/* Set a timestamp after the sales have ended */]);

            // Get the initial balance of unsold tokens
            const initialUnsoldTokens = await bearRumble.balanceOf(ico.address);

            // Burn unsold tokens
            await ico.burnUnsoldTokens();

            // Check if the unsold tokens were burned correctly
            expect(await bearRumble.balanceOf(ico.address)).to.be.lt(initialUnsoldTokens);
        });
    });
});
