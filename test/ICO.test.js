const { ethers } = require("hardhat");
const { expect } = require("chai");

describe.only("ICO Contract", function () {
    let ICO, BearRumble, ico, bearRumble, owner, addr1, addr2, addr3, addr4;

    // Set deployment parameters
    const saleOnePrice = 1000;
    const saleTwoPrice = 2000;
    const saleOneSupply = 100_000n * 10n ** 18n;
    const saleTwoSupply = 200_000n * 10n ** 18n;
    const saleOneMinPurchase = 100n * 10n ** 18n;
    const saleTwoMinPurchase = 200n * 10n ** 18n;
    const saleOneStart = Math.round(Date.now() / 1000) + 60 * 60 * 24 * 7; // 7 days from now
    const saleOneEnd = saleOneStart + 60 * 60 * 24 * 7; // 7 days
    const saleTwoStart = saleOneEnd + 60 * 60 * 24 * 7; // 7 days after SaleOne ends
    const saleTwoEnd = saleTwoStart + 60 * 60 * 24 * 7; // 7 days
    const cliffPeriod = 60 * 60 * 24 * 30; // 30 days
    const vestingPeriod = 60 * 60 * 24 * 180; // 180 days

    const saleOne = [saleOnePrice, saleOneSupply, 0, saleOneMinPurchase, saleOneStart, saleOneEnd];
    const saleTwo = [saleTwoPrice, saleTwoSupply, 0, saleTwoMinPurchase, saleTwoStart, saleTwoEnd];

    beforeEach(async function () {
        // Reset the hardhat network
        await ethers.provider.send("hardhat_reset", []);

        // Deploy contracts
        ICO = await ethers.getContractFactory("ICO");
        BearRumble = await ethers.getContractFactory("BearRumble");

        bearRumble = await BearRumble.deploy();
        await bearRumble.waitForDeployment();

        ico = await ICO.deploy(bearRumble.target,
            saleOne,
            saleTwo,
            cliffPeriod,
            vestingPeriod
        );
        await ico.waitForDeployment();
        // Get signers
        [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

        // Transfer tokens to the ICO contract
        await bearRumble.transfer(ico.target, saleOneSupply + saleTwoSupply);
    });

    /**
     * Hook to simulate a complete ICO
     * It should:
     * - Set the timestamp to be within SaleOne
     * - Add addr1 to addr4 to the whitelist
     * - Buy tokens with addr1 to addr4
     * - Set the timestamp to be within SaleTwo
     * - Buy tokens with addr1 to addr4
     * - Set the timestamp to be in the vesting period and claim tokens with addr1 to addr4
     */
    async function simulateCompleteICO() {
        // Set the timestamp to be within SaleOne
        await ethers.provider.send("evm_setNextBlockTimestamp", [saleOneStart]);

        // Add addr1 to addr4 to the whitelist
        await ico.manageWhitelist([addr1.address, addr2.address, addr3.address, addr4.address], [true, true, true, true]);

        // Buy tokens with addr1 to addr4
        const tokenAmount = ethers.parseEther((saleOnePrice * 10).toString());
        await ico.connect(addr1).buyTokens(tokenAmount, { value: tokenAmount / BigInt(saleOnePrice) });
        await ico.connect(addr2).buyTokens(tokenAmount, { value: tokenAmount / BigInt(saleOnePrice) });
        await ico.connect(addr3).buyTokens(tokenAmount, { value: tokenAmount / BigInt(saleOnePrice) });
        await ico.connect(addr4).buyTokens(tokenAmount, { value: tokenAmount / BigInt(saleOnePrice) });

        // Set the timestamp to be within SaleTwo
        await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoStart]);

        // Buy tokens with addr1 to addr4
        const tokenAmount2 = ethers.parseEther((saleTwoPrice * 10).toString());
        await ico.connect(addr1).buyTokens(tokenAmount2, { value: tokenAmount2 / BigInt(saleTwoPrice) });
        await ico.connect(addr2).buyTokens(tokenAmount2, { value: tokenAmount2 / BigInt(saleTwoPrice) });
        await ico.connect(addr3).buyTokens(tokenAmount2, { value: tokenAmount2 / BigInt(saleTwoPrice) });
        await ico.connect(addr4).buyTokens(tokenAmount2, { value: tokenAmount2 / BigInt(saleTwoPrice) });

        // Set the timestamp to be in the vesting period
        await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoEnd + cliffPeriod + vestingPeriod / 2]);

        // Claim tokens with addr1 to addr4
        await ico.connect(addr1).claimTokens();
        await ico.connect(addr2).claimTokens();
        await ico.connect(addr3).claimTokens();
        await ico.connect(addr4).claimTokens();

    }

    describe("Deployment", function () {
        it("Should set the correct parameters", async function () {
            expect(await ico.token).to.equal(bearRumble.address);

            const saleOne = await ico.saleOne();
            const saleTwo = await ico.saleTwo();

            expect(saleOne[0]).to.equal(saleOnePrice);
            expect(saleOne[1]).to.equal(saleOneSupply);
            expect(saleOne[2]).to.equal(0);
            expect(saleOne[3]).to.equal(saleOneMinPurchase);
            expect(saleOne[4]).to.equal(saleOneStart);
            expect(saleOne[5]).to.equal(saleOneEnd);

            expect(saleTwo[0]).to.equal(saleTwoPrice);
            expect(saleTwo[1]).to.equal(saleTwoSupply);
            expect(saleTwo[2]).to.equal(0);
            expect(saleTwo[3]).to.equal(saleTwoMinPurchase);
            expect(saleTwo[4]).to.equal(saleTwoStart);
            expect(saleTwo[5]).to.equal(saleTwoEnd);

            expect(await ico.cliffPeriod()).to.equal(cliffPeriod);
            expect(await ico.vestingPeriod()).to.equal(vestingPeriod);
            expect(await ico.whitelist(owner.address)).to.be.true;
        });
    });

    describe("Whitelisting", function () {
        it("Should add an address to the whitelist", async function () {
            // Add addr1 to the whitelist
            await ico.manageWhitelist([addr1.address], [true]);

            // Check if addr1 is whitelisted
            expect(await ico.whitelist(addr1.address)).to.be.true;
        });

        it("Should add multiple addresses to the whitelist", async function () {
            // Add addr1 and addr2 to the whitelist
            await ico.manageWhitelist([addr1.address, addr2.address], [true, true]);

            // Check if addr1 and addr2 are whitelisted
            expect(await ico.whitelist(addr1.address)).to.be.true;
            expect(await ico.whitelist(addr2.address)).to.be.true;
        });

        it("Should not add an address to the whitelist if not the owner", async function () {
            // Add addr1 to the whitelist
            await expect(ico.connect(addr1).manageWhitelist([addr1.address], [true]))
                .to.be.revertedWithCustomError(ico, "OwnableUnauthorizedAccount");
        });

        it("Should remove an address from the whitelist", async function () {
            // Add addr1 to the whitelist
            await ico.manageWhitelist([addr1.address,], [true]);

            // Remove addr1 from the whitelist
            await ico.manageWhitelist([addr1.address, addr2.address], [false, true]);

            // Check if addr1 is not whitelisted
            expect(await ico.whitelist(addr1.address)).to.be.false;
            expect(await ico.whitelist(addr2.address)).to.be.true;
        });

        it("Should revert if the length of the addresses and the booleans are different", async function () {
            // Add addr1 to the whitelist
            await expect(ico.manageWhitelist([addr1.address, addr2.address], [true]))
                .to.be.revertedWith("Arrays length mismatch");
        });
    });

    describe("Buying tokens", function () {
        it("Should buy tokens during SaleOne", async function () {
            // Set the timestamp to be within SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleOneStart]);

            // Add addr1 to the whitelist
            await ico.manageWhitelist([addr1.address], [true]);

            const contractBalanceBefore = await ethers.provider.getBalance(ico.target);

            // Buy tokens with addr1
            const tokenAmount = ethers.parseEther((saleOnePrice * 10).toString());
            await ico.connect(addr1).buyTokens(tokenAmount, { value: tokenAmount / BigInt(saleOnePrice) });

            const saleOne = await ico.saleOne();
            // Check if the tokens were bought correctly
            expect(await ico.boughtTokens(addr1.address)).to.equal(tokenAmount);
            expect(saleOne[2]).to.equal(tokenAmount);

            // Check if the contract balance is correct
            expect(await ethers.provider.getBalance(ico.target)).to.equal(contractBalanceBefore + tokenAmount / BigInt(saleOnePrice));

            // Check if the event was emitted correctly
            expect(await ico.connect(addr1).buyTokens(tokenAmount, { value: tokenAmount / BigInt(saleOnePrice) }))
                .to.emit(ico, "TokenPurchased")
                .withArgs(addr1.address, tokenAmount, tokenAmount / BigInt(saleOnePrice));
        });

        it("Should buy tokens during SaleTwo", async function () {
            // Set the timestamp to be within SaleTwo
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoStart]);

            // Add addr1 to the whitelist
            await ico.manageWhitelist([addr1.address], [true]);

            const contractBalanceBefore = await ethers.provider.getBalance(ico.target);

            // Buy tokens with addr1
            const tokenAmount = ethers.parseEther((saleTwoPrice * 10).toString());
            await ico.connect(addr1).buyTokens(tokenAmount, { value: tokenAmount / BigInt(saleTwoPrice) });

            const saleTwo = await ico.saleTwo();
            // Check if the tokens were bought correctly
            expect(await ico.boughtTokens(addr1.address)).to.equal(tokenAmount);
            expect(saleTwo[2]).to.equal(tokenAmount);

            // Check if the owner balance is correct
            expect(await ethers.provider.getBalance(ico.target)).to.equal(contractBalanceBefore + tokenAmount / BigInt(saleTwoPrice));

            // Check if the event was emitted correctly
            expect(await ico.connect(addr1).buyTokens(tokenAmount, { value: tokenAmount / BigInt(saleTwoPrice) }))
                .to.emit(ico, "TokenPurchased")
                .withArgs(addr1.address, tokenAmount, tokenAmount / BigInt(saleTwoPrice));
        });

        it("Should buy every token in the sale", async function () {
            // Set the timestamp to be within SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleOneStart]);

            // Add addr1 to the whitelist
            await ico.manageWhitelist([addr1.address], [true]);

            // Buy tokens with addr1
            const tokenAmount = saleOneSupply;
            await ico.connect(addr1).buyTokens(tokenAmount, { value: tokenAmount / BigInt(saleOnePrice) });

            // Check if the tokens were bought correctly
            expect(await ico.boughtTokens(addr1.address)).to.equal(tokenAmount);

            // Set the timestamp to be within SaleTwo
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoStart]);

            // Buy tokens with addr1
            const tokenAmount2 = saleTwoSupply;
            await ico.connect(addr1).buyTokens(tokenAmount2, { value: tokenAmount2 / BigInt(saleTwoPrice) });

            // Check if the tokens were bought correctly
            expect(await ico.boughtTokens(addr1.address)).to.equal(tokenAmount + tokenAmount2);
        });

        it("Should not buy tokens outstide of sales period", async function () {
            // Test before saleOneStart, between saleOneEnd and saleTwoStart, and after saleTwoEnd
            const tokenAmount = ethers.parseEther((saleOnePrice * 10).toString());
            //WhiteList
            await ico.manageWhitelist([addr1.address], [true]);

            await ethers.provider.send("evm_setNextBlockTimestamp", [saleOneStart - 60 * 60 * 24 * 1]);
            await expect(ico.connect(addr1).buyTokens(tokenAmount, { value: 10 })).to.be.revertedWith("Sale not active");
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleOneEnd + 60 * 60 * 24 * 1]);
            await expect(ico.connect(addr1).buyTokens(tokenAmount, { value: 10 })).to.be.revertedWith("Sale not active");
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoEnd + 60 * 60 * 24 * 1]);
            await expect(ico.connect(addr1).buyTokens(tokenAmount, { value: 10 })).to.be.revertedWith("Sale not active");
        });

        it("Should not buy tokens if not whitelisted", async function () {
            // Set the timestamp to be within SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleOneStart]);

            // Buy tokens with addr1
            const tokenAmount = ethers.parseEther((saleOnePrice * 10).toString());
            await expect(ico.connect(addr1).buyTokens(tokenAmount, { value: tokenAmount / BigInt(saleOnePrice) }))
                .to.be.revertedWith("Not whitelisted");
        });

        it("Should not buy tokens if the sale supply is exceeded", async function () {
            // Set the timestamp to be within SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleOneStart]);

            // Add addr1 to the whitelist
            await ico.manageWhitelist([addr1.address], [true]);

            // Buy tokens with addr1
            const tokenAmount = saleOneSupply + 1n;
            await expect(ico.connect(addr1).buyTokens(tokenAmount, { value: tokenAmount / BigInt(saleOnePrice) }))
                .to.be.revertedWith("Insufficient remaining tokens supply");

            // Set the timestamp to be within SaleTwo
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoStart]);

            // Buy tokens with addr1
            const tokenAmount2 = saleTwoSupply + 1n;
            await expect(ico.connect(addr1).buyTokens(tokenAmount2, { value: tokenAmount2 / BigInt(saleTwoPrice) }))
                .to.be.revertedWith("Insufficient remaining tokens supply");
        });

        it("Should not buy tokens if the ether sent is wrong", async function () {
            // Set the timestamp to be within SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleOneStart]);

            // Add addr1 to the whitelist
            await ico.manageWhitelist([addr1.address], [true]);

            // Buy tokens with addr1
            const tokenAmount = ethers.parseEther((saleOnePrice * 10).toString());
            await expect(ico.connect(addr1).buyTokens(tokenAmount,
                { value: (tokenAmount / BigInt(saleTwoPrice)) - 1n }))
                .to.be.revertedWith("Wrong amount of Ether sent");

            await expect(ico.connect(addr1).buyTokens(tokenAmount,
                { value: (tokenAmount / BigInt(saleTwoPrice)) + 1n }))
                .to.be.revertedWith("Wrong amount of Ether sent");
        });
    });

    describe("Claiming tokens", function () {
        it("Should claim tokens after the sale has ended", async function () {
            // Set the timestamp to be within SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoStart + 60 * 60 * 24 * 1]);

            // Add addr1 to the whitelist
            await ico.manageWhitelist([addr1.address], [true]);

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

        it("Should claim all tokens after the vesting period", async function () {
            // Set the timestamp to be within SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoStart + 60 * 60 * 24 * 1]);

            // Add addr1 to the whitelist
            await ico.manageWhitelist([addr1.address], [true]);

            // Buy tokens with addr1
            const tokenAmount = ethers.parseEther((saleTwoPrice * 10).toString());
            await ico.connect(addr1).buyTokens(tokenAmount, { value: tokenAmount / BigInt(saleTwoPrice) });

            // Set the timestamp to be after the vesting period
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoEnd + cliffPeriod + vestingPeriod]);

            // Claim tokens with addr1
            const initialBalance = await bearRumble.balanceOf(addr1.address);
            await ico.connect(addr1).claimTokens();
            const finalBalance = await bearRumble.balanceOf(addr1.address);
            const claimedTokens = await ico.claimedTokens(addr1.address);

            // Check if the tokens were claimed correctly
            expect(finalBalance).to.equal(initialBalance + tokenAmount);
            expect(claimedTokens).to.equal(tokenAmount);
        });

        it("Should not claim tokens before the cliff period", async function () {
            // Set the timestamp to be within SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoStart + 60 * 60 * 24 * 1]);

            // Add addr1 to the whitelist
            await ico.manageWhitelist([addr1.address], [true]);

            // Buy tokens with addr1
            const tokenAmount = ethers.parseEther((saleTwoPrice * 10).toString());
            await ico.connect(addr1).buyTokens(tokenAmount, { value: tokenAmount / BigInt(saleTwoPrice) });

            // Set the timestamp to be within the cliff period
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoEnd + cliffPeriod / 2]);

            // Claim tokens with addr1
            await expect(ico.connect(addr1).claimTokens()).to.be.revertedWith("Claim period not started");
        });

        it("Should not claim tokens if the address is not whitelisted", async function () {

            // Set the timestamp to be after the cliff period and within the vesting period
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoEnd + cliffPeriod + vestingPeriod / 2]);

            // Claim tokens with addr1
            await expect(ico.connect(addr1).claimTokens()).to.be.revertedWith("Not whitelisted");
        });

        it("Should claim zero tokens if the address has already claimed all tokens", async function () {
            // Set the timestamp to be within SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoStart + 60 * 60 * 24 * 1]);

            // Add addr1 to the whitelist
            await ico.manageWhitelist([addr1.address], [true]);

            // Buy tokens with addr1
            const tokenAmount = ethers.parseEther((saleTwoPrice * 10).toString());
            await ico.connect(addr1).buyTokens(tokenAmount, { value: tokenAmount / BigInt(saleTwoPrice) });

            // Set the timestamp to be after the cliff period and within the vesting period
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoEnd + cliffPeriod + vestingPeriod + 1]);

            // Claim tokens with addr1
            await ico.connect(addr1).claimTokens();

            // Claim tokens with addr1 again
            await expect(ico.connect(addr1).claimTokens()).to.be.revertedWith("No claimable tokens");
        });
    });

    describe("Burning unsold tokens", function () {
        it("Should burn unsold tokens in the cliff period", async function () {

            // Set the timestamp to be after the sales have ended
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoEnd + cliffPeriod / 2]);
            const tokenBalanceBefore = await bearRumble.balanceOf(ico.target);

            const soldTokensSale1 = (await ico.saleOne())[2];
            const soldTokensSale2 = (await ico.saleTwo())[2];
            const unsoldTokens = (saleOneSupply + saleTwoSupply) - (soldTokensSale1 + soldTokensSale2);

            // Burn unsold tokens
            await ico.burnUnsoldTokens();

            // Check if the unsold tokens were burned correctly
            expect(await bearRumble.balanceOf(ico.target)).to.equal(tokenBalanceBefore - unsoldTokens);
        });

        it("Should burn unsold tokens in the vesting period", async function () {
            // Set the timestamp to be after the sales have ended
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoEnd + cliffPeriod + vestingPeriod / 2]);

            const tokenBalanceBefore = await bearRumble.balanceOf(ico.target);

            const soldTokensSale1 = (await ico.saleOne())[2];
            const soldTokensSale2 = (await ico.saleTwo())[2];
            const unsoldTokens = (saleOneSupply + saleTwoSupply) - (soldTokensSale1 + soldTokensSale2);

            // Burn unsold tokens
            await ico.burnUnsoldTokens();

            // Check if the unsold tokens were burned correctly
            expect(await bearRumble.balanceOf(ico.target)).to.equal(tokenBalanceBefore - unsoldTokens);
        });

        it("Should burn unsold tokens after the vesting period", async function () {

            await simulateCompleteICO();

            // Set the timestamp to be after the sales have ended
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoEnd + cliffPeriod + vestingPeriod]);

            const tokenBalanceBefore = await bearRumble.balanceOf(ico.target);

            const soldTokensSale1 = (await ico.saleOne())[2];
            const soldTokensSale2 = (await ico.saleTwo())[2];
            const unsoldTokens = (saleOneSupply + saleTwoSupply) - (soldTokensSale1 + soldTokensSale2);

            // Burn unsold tokens
            await ico.burnUnsoldTokens();

            // Check if the unsold tokens were burned correctly
            expect(await bearRumble.balanceOf(ico.target)).to.equal(tokenBalanceBefore - unsoldTokens);
        });

        it("Should emit the correct event when burning unsold tokens", async function () {
            // Set the timestamp to be after the sales have ended
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoEnd + 60 * 60 * 24 * 1]);

            // Burn unsold tokens
            expect(await ico.burnUnsoldTokens())
                .to.emit(ico, "UnsoldTokensBurned")
                .withArgs(saleOneSupply + saleTwoSupply);
        });

        it("Should not burn unsold tokens before the sales have ended", async function () {
            // Set the timestamp to be within SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleOneStart]);

            // Burn unsold tokens
            await expect(ico.burnUnsoldTokens()).to.be.revertedWith("Sale not ended");
        });

        it("Should not burn unsold tokens if not the owner", async function () {
            // Set the timestamp to be after the sales have ended
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoEnd + 60 * 60 * 24 * 1]);

            // Burn unsold tokens
            await expect(ico.connect(addr1).burnUnsoldTokens())
                .to.be.revertedWithCustomError(ico, "OwnableUnauthorizedAccount");
        });



    });
});
