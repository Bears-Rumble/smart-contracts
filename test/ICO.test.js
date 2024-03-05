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
        // Reset the hardhat network
        await ethers.provider.send("hardhat_reset", []);

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

        // Transfer tokens to the ICO contract
        await bearRumble.transfer(ico.target, saleOneSupply + saleTwoSupply);
    });

    describe("Deployment", function () {
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
            expect(await ico.whitelist(owner.address)).to.be.true;
        });
    });

    describe("Whitelisting", function () {
        it("Should add an address to the whitelist", async function () {
            // Add addr1 to the whitelist
            await ico.addToWhitelist([addr1.address]);

            // Check if addr1 is whitelisted
            expect(await ico.whitelist(addr1.address)).to.be.true;
        });

        it("Should add multiple addresses to the whitelist", async function () {
            // Add addr1 and addr2 to the whitelist
            await ico.addToWhitelist([addr1.address, addr2.address]);

            // Check if addr1 and addr2 are whitelisted
            expect(await ico.whitelist(addr1.address)).to.be.true;
            expect(await ico.whitelist(addr2.address)).to.be.true;
        });
    });

    describe("Buying tokens", function () {
        it("Should buy tokens during SaleOne", async function () {
            // Set the timestamp to be within SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleOneStart]);

            // Add addr1 to the whitelist
            await ico.addToWhitelist([addr1.address]);

            const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);

            // Buy tokens with addr1
            const tokenAmount = ethers.parseEther((saleOnePrice * 10).toString());
            await ico.connect(addr1).buyTokens(tokenAmount, { value: tokenAmount / BigInt(saleOnePrice) });

            // Check if the tokens were bought correctly
            expect(await ico.boughtTokens(addr1.address)).to.equal(tokenAmount);

            // Check if the owner balance is correct
            expect(await ethers.provider.getBalance(owner.address)).to.equal(ownerBalanceBefore + tokenAmount / BigInt(saleOnePrice));

            // Check if the event was emitted correctly
            expect(await ico.connect(addr1).buyTokens(tokenAmount, { value: tokenAmount / BigInt(saleOnePrice) }))
                .to.emit(ico, "TokenPurchased")
                .withArgs(addr1.address, tokenAmount, tokenAmount / BigInt(saleOnePrice));
        });

        it("Should buy tokens during SaleTwo", async function () {
            // Set the timestamp to be within SaleTwo
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoStart]);

            // Add addr1 to the whitelist
            await ico.addToWhitelist([addr1.address]);

            const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);

            // Buy tokens with addr1
            const tokenAmount = ethers.parseEther((saleTwoPrice * 10).toString());
            await ico.connect(addr1).buyTokens(tokenAmount, { value: tokenAmount / BigInt(saleTwoPrice) });

            // Check if the tokens were bought correctly
            expect(await ico.boughtTokens(addr1.address)).to.equal(tokenAmount);

            // Check if the owner balance is correct
            expect(await ethers.provider.getBalance(owner.address)).to.equal(ownerBalanceBefore + tokenAmount / BigInt(saleTwoPrice));

            // Check if the event was emitted correctly
            expect(await ico.connect(addr1).buyTokens(tokenAmount, { value: tokenAmount / BigInt(saleTwoPrice) }))
                .to.emit(ico, "TokenPurchased")
                .withArgs(addr1.address, tokenAmount, tokenAmount / BigInt(saleTwoPrice));
        });
    });

    describe("Claiming tokens", function () {
        it("Should claim tokens after the sale has ended", async function () {
            // Set the timestamp to be within SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoStart + 60 * 60 * 24 * 1]);

            // Add addr1 to the whitelist
            await ico.addToWhitelist([addr1.address]);

            // Buy tokens with addr1
            const tokenAmount = ethers.parseEther((saleTwoPrice * 10).toString());
            await ico.connect(addr1).buyTokens(tokenAmount, { value: tokenAmount / BigInt(saleTwoPrice) });

            // Set the timestamp to be after the cliff period and within the vesting period
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoEnd + cliffPeriod + vestingPeriod / 2]);

            // Claim tokens with addr1
            const initialBalance = await bearRumble.balanceOf(addr1.address);
            await ico.connect(addr1).claimTokens();
            const finalBalance = await bearRumble.balanceOf(addr1.address);
            const claimedTokens = await ico.claimedTokens(addr1.address);

            // Check if the tokens were claimed correctly
            expect(finalBalance).to.equal(initialBalance + tokenAmount / 2n);
            expect(claimedTokens).to.equal(tokenAmount / 2n);
        });
    });

    describe("Burning unsold tokens", function () {
        it("Should burn unsold tokens after the sale has ended", async function () {
            // Set the timestamp to be after the sales have ended
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoEnd + 60 * 60 * 24 * 1]);

            // Burn unsold tokens
            await ico.burnUnsoldTokens();

            // Check if the unsold tokens were burned correctly
            expect(await bearRumble.balanceOf(ico.target)).to.equal(0n);
        });
    });
});
