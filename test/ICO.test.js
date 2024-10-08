const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("ICO Contract", function () {
    let ICO, BearsRumble, ico, bearsRumble, owner, addr1, addr2, addr3, addr4;
    const zeroAddress = ethers.ZeroAddress;

    // Set deployment parameters
    const saleOnePrice = 100_000; // Price in Tokens per Ether
    const saleOneSupply = 40_000_000n * 10n ** 18n;
    const saleOneMinPurchase = 20_000n * 10n ** 18n; // About 500 USD  
    const saleOneStart = Math.round(Date.now() / 1000) + 60 * 60 * 24 * 7; // 7 days from now
    const saleOneEnd = saleOneStart + 60 * 60 * 24 * 30; // 30 days
    const saleOneMinTokensSold = 140_000n * 10n ** 18n;

    const saleTwoPrice = 50_000; // Price in Tokens per Ether
    const saleTwoSupply = 50_000_000n * 10n ** 18n;
    const saleTwoMinPurchase = 15_000n * 10n ** 18n; // About 200 USD
    const saleTwoStart = saleOneEnd + 60 * 60 * 24 * 60; // 60 days after SaleOne ends
    const saleTwoEnd = saleTwoStart + 60 * 60 * 24 * 30; // 30 days
    const saleTwoMinTokensSold = 70_000n * 10n ** 18n;

    const saleThreePrice = 50_000; // Price in Tokens per Ether
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
    const referralSupply = (saleOneSupply + saleTwoSupply + saleThreeSupply) * 2n / 100n;

    const referralRate = 40n; // 2,5% of the total supply (100%/40)

    beforeEach(async function () {
        // Reset the hardhat network
        await ethers.provider.send("hardhat_reset", []);

        // Deploy contracts
        ICO = await ethers.getContractFactory("ICO");
        BearsRumble = await ethers.getContractFactory("BearsRumble");

        bearsRumble = await BearsRumble.deploy();
        await bearsRumble.waitForDeployment();

        ico = await ICO.deploy(bearsRumble.target,
            saleOne,
            saleTwo,
            saleThree,
            cliffPeriod,
            vestingPeriod,
            referralRate
        );
        await ico.waitForDeployment();
        // Get signers
        [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

        // Transfer tokens to the ICO contract
        await bearsRumble.transfer(ico.target, saleOneSupply + saleTwoSupply + saleThreeSupply + referralSupply);
    });

    /**
     * Hook to simulate a complete ICO
     * It:
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
        const paidEthers1 = tokenAmount / BigInt(saleOnePrice);
        await ico.connect(addr1).buyTokens(tokenAmount, zeroAddress, { value: paidEthers1 });
        await ico.connect(addr2).buyTokens(tokenAmount * 2n, zeroAddress, { value: 2n * paidEthers1 });
        await ico.connect(addr3).buyTokens(tokenAmount * 5n, zeroAddress, { value: 5n * paidEthers1 });
        await ico.connect(addr4).buyTokens(tokenAmount * 10n, zeroAddress, { value: 10n * paidEthers1 });

        // Set the timestamp to be between SaleOne and SaleTwo
        await ethers.provider.send("evm_setNextBlockTimestamp", [(saleOneEnd + saleTwoStart) / 2]);

        // End SaleOne
        await ico.endSale(1);

        // Set the timestamp to be within SaleTwo
        await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoStart]);

        // Buy tokens with addr1 to addr4
        const tokenAmount2 = ethers.parseEther((saleTwoPrice * 10).toString());
        const paidEthers2 = tokenAmount2 / BigInt(saleTwoPrice);
        await ico.connect(addr1).buyTokens(tokenAmount2, zeroAddress, { value: paidEthers2 });
        await ico.connect(addr2).buyTokens(tokenAmount2, zeroAddress, { value: paidEthers2 });
        await ico.connect(addr3).buyTokens(tokenAmount2, zeroAddress, { value: paidEthers2 });
        await ico.connect(addr4).buyTokens(tokenAmount2, zeroAddress, { value: paidEthers2 });

        await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoEnd + 60 * 60 * 24 * 1]);

        // End SaleTwo
        await ico.endSale(2);

        // Set the timestamp to be within SaleThree
        await ethers.provider.send("evm_setNextBlockTimestamp", [saleThreeStart]);

        // Buy tokens with addr1 to addr4
        const tokenAmount3 = ethers.parseEther((saleThreePrice * 10).toString());
        const paidEthers3 = tokenAmount3 / BigInt(saleThreePrice);
        await ico.connect(addr1).buyTokens(tokenAmount3, zeroAddress, { value: paidEthers3 });
        await ico.connect(addr2).buyTokens(tokenAmount3, zeroAddress, { value: paidEthers3 });
        await ico.connect(addr3).buyTokens(tokenAmount3, zeroAddress, { value: paidEthers3 });
        await ico.connect(addr4).buyTokens(tokenAmount3 * 30n, zeroAddress, { value: paidEthers3 * 30n });

        await ethers.provider.send("evm_setNextBlockTimestamp", [saleThreeEnd + 60 * 60 * 24 * 1]);

        // End SaleThree
        await ico.endSale(3);

        // Set the timestamp to be in the vesting period
        await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoEnd + cliffPeriod + vestingPeriod / 2]);

        // Claim tokens with addr1 to addr4
        await ico.connect(addr1).claimTokens();
        await ico.connect(addr2).claimTokens();
        await ico.connect(addr3).claimTokens();
        await ico.connect(addr4).claimTokens();

        await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoEnd + cliffPeriod + vestingPeriod + 60 * 60 * 24 * 1]);

        // Claim tokens with addr1 to addr4
        await ico.connect(addr1).claimTokens();
        await ico.connect(addr2).claimTokens();
        await ico.connect(addr3).claimTokens();
        await ico.connect(addr4).claimTokens();

        const totalPaidEther = paidEthers1 * 18n + paidEthers2 * 4n + paidEthers3 * 38n;

        return totalPaidEther;
    }

    /**
     * Hook to simulate a complete SaleOne
     * It should:
     * - Set the timestamp to be within SaleOne
     * - Add addr1 to addr4 to the whitelist
     * - Buy tokens with addr1 to addr4
     * - Return the total amount of ethers paid
     * @returns {BigInt} The total amount of ethers paid
     * 
     */
    async function simulateSaleOne() {
        // Set the timestamp to be within SaleOne
        await ethers.provider.send("evm_setNextBlockTimestamp", [saleOneStart]);

        // Add addr1 to addr4 to the whitelist
        await ico.manageWhitelist([addr1.address, addr2.address, addr3.address, addr4.address], [true, true, true, true]);

        // Buy tokens with addr1 to addr4
        const tokenAmount = ethers.parseEther((saleOnePrice * 10).toString());
        const ethersAmount = tokenAmount / BigInt(saleOnePrice);
        await ico.connect(addr1).buyTokens(tokenAmount, zeroAddress, { value: ethersAmount });
        await ico.connect(addr2).buyTokens(tokenAmount * 2n, zeroAddress, { value: 2n * ethersAmount });
        await ico.connect(addr3).buyTokens(tokenAmount * 5n, zeroAddress, { value: 5n * ethersAmount });
        await ico.connect(addr4).buyTokens(tokenAmount * 10n, zeroAddress, { value: 10n * ethersAmount });

        return ethersAmount * 18n;
    }

    async function simulateSaleTwo() {
        // Set the timestamp to be within SaleTwo
        await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoStart]);

        // Add addr1 to addr4 to the whitelist
        await ico.manageWhitelist([addr1.address, addr2.address, addr3.address, addr4.address], [true, true, true, true]);

        // Buy tokens with addr1 to addr4
        const tokenAmount = ethers.parseEther((saleTwoPrice * 10).toString());
        const ethersAmount = tokenAmount / BigInt(saleTwoPrice);
        await ico.connect(addr1).buyTokens(tokenAmount, zeroAddress, { value: ethersAmount });
        await ico.connect(addr2).buyTokens(tokenAmount * 2n, zeroAddress, { value: 2n * ethersAmount });
        await ico.connect(addr3).buyTokens(tokenAmount * 5n, zeroAddress, { value: 5n * ethersAmount });
        await ico.connect(addr4).buyTokens(tokenAmount * 10n, zeroAddress, { value: 10n * ethersAmount });

        return ethersAmount * 18n;
    }

    async function simulateSaleThree() {
        // Set the timestamp to be within SaleThree
        await ethers.provider.send("evm_setNextBlockTimestamp", [saleThreeStart]);

        // Add addr1 to addr4 to the whitelist
        await ico.manageWhitelist([addr1.address, addr2.address, addr3.address, addr4.address], [true, true, true, true]);

        // Buy tokens with addr1 to addr4
        const tokenAmount = ethers.parseEther((saleThreePrice * 10).toString());
        const ethersAmount = tokenAmount / BigInt(saleThreePrice);
        await ico.connect(addr1).buyTokens(tokenAmount, zeroAddress, { value: ethersAmount });
        await ico.connect(addr2).buyTokens(tokenAmount * 2n, zeroAddress, { value: 2n * ethersAmount });
        await ico.connect(addr3).buyTokens(tokenAmount * 5n, zeroAddress, { value: 5n * ethersAmount });
        await ico.connect(addr4).buyTokens(tokenAmount * 30n, zeroAddress, { value: 30n * ethersAmount });

        return ethersAmount * 38n;
    }

    describe("Deployment", function () {
        it("Should set the correct parameters", async function () {
            expect(await ico.token()).to.equal(bearsRumble.target);

            const saleOne = await ico.saleOne();
            const saleTwo = await ico.saleTwo();
            const saleThree = await ico.saleThree();

            expect(saleOne[0]).to.equal(saleOnePrice);
            expect(saleOne[1]).to.equal(saleOneSupply);
            expect(saleOne[2]).to.equal(0);
            expect(saleOne[3]).to.equal(saleOneMinPurchase);
            expect(saleOne[4]).to.equal(saleOneStart);
            expect(saleOne[5]).to.equal(saleOneEnd);
            expect(saleOne[6]).to.equal(saleOneMinTokensSold);
            expect(saleOne[7]).to.be.false;
            expect(saleOne[8]).to.be.false;

            expect(saleTwo[0]).to.equal(saleTwoPrice);
            expect(saleTwo[1]).to.equal(saleTwoSupply);
            expect(saleTwo[2]).to.equal(0);
            expect(saleTwo[3]).to.equal(saleTwoMinPurchase);
            expect(saleTwo[4]).to.equal(saleTwoStart);
            expect(saleTwo[5]).to.equal(saleTwoEnd);
            expect(saleTwo[6]).to.equal(saleTwoMinTokensSold);
            expect(saleTwo[7]).to.be.false;
            expect(saleTwo[8]).to.be.false;

            expect(saleThree[0]).to.equal(saleThreePrice);
            expect(saleThree[1]).to.equal(saleThreeSupply);
            expect(saleThree[2]).to.equal(0);
            expect(saleThree[3]).to.equal(saleThreeMinPurchase);
            expect(saleThree[4]).to.equal(saleThreeStart);
            expect(saleThree[5]).to.equal(saleThreeEnd);
            expect(saleThree[6]).to.equal(saleThreeMinTokensSold);
            expect(saleThree[7]).to.be.false;
            expect(saleThree[8]).to.be.false;

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
                .to.revertedWith("Not whitelist manager");
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
            await ico.connect(addr1).buyTokens(tokenAmount, zeroAddress, { value: tokenAmount / BigInt(saleOnePrice) });

            const saleOne = await ico.saleOne();
            // Check if the tokens were bought correctly
            expect(await ico.boughtTokensSaleOne(addr1.address)).to.equal(tokenAmount);
            expect(saleOne[2]).to.equal(tokenAmount);

            // Check if the contract balance is correct
            expect(await ethers.provider.getBalance(ico.target)).to.equal(contractBalanceBefore + tokenAmount / BigInt(saleOnePrice));

            // Check if the event was emitted correctly
            expect(await ico.connect(addr1).buyTokens(tokenAmount, zeroAddress, { value: tokenAmount / BigInt(saleOnePrice) }))
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
            await ico.connect(addr1).buyTokens(tokenAmount, zeroAddress, { value: tokenAmount / BigInt(saleTwoPrice) });

            const saleTwo = await ico.saleTwo();
            // Check if the tokens were bought correctly
            expect(await ico.boughtTokensSaleTwo(addr1.address)).to.equal(tokenAmount);
            expect(saleTwo[2]).to.equal(tokenAmount);

            // Check if the owner balance is correct
            expect(await ethers.provider.getBalance(ico.target)).to.equal(contractBalanceBefore + tokenAmount / BigInt(saleTwoPrice));

            // Check if the event was emitted correctly
            expect(await ico.connect(addr1).buyTokens(tokenAmount, zeroAddress, { value: tokenAmount / BigInt(saleTwoPrice) }))
                .to.emit(ico, "TokenPurchased")
                .withArgs(addr1.address, tokenAmount, tokenAmount / BigInt(saleTwoPrice));
        });

        it("Should buy tokens during SaleThree", async function () {
            // Set the timestamp to be within SaleThree
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleThreeStart]);

            // Add addr1 to the whitelist
            await ico.manageWhitelist([addr1.address], [true]);

            const contractBalanceBefore = await ethers.provider.getBalance(ico.target);

            // Buy tokens with addr1
            const tokenAmount = ethers.parseEther((saleThreePrice * 10).toString());
            await ico.connect(addr1).buyTokens(tokenAmount, zeroAddress, { value: tokenAmount / BigInt(saleThreePrice) });

            const saleThree = await ico.saleThree();
            // Check if the tokens were bought correctly
            expect(await ico.boughtTokensSaleThree(addr1.address)).to.equal(tokenAmount);
            expect(saleThree[2]).to.equal(tokenAmount);

            // Check if the owner balance is correct
            expect(await ethers.provider.getBalance(ico.target)).to.equal(contractBalanceBefore + tokenAmount / BigInt(saleThreePrice));

            // Check if the event was emitted correctly
            expect(await ico.connect(addr1).buyTokens(tokenAmount, zeroAddress, { value: tokenAmount / BigInt(saleThreePrice) }))
                .to.emit(ico, "TokenPurchased")
                .withArgs(addr1.address, tokenAmount, tokenAmount / BigInt(saleThreePrice));
        });

        it("Should buy every token in the sale", async function () {
            // Set the timestamp to be within SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleOneStart]);

            // Add addr1 to the whitelist
            await ico.manageWhitelist([addr1.address], [true]);

            // Buy tokens with addr1
            const tokenAmount1 = saleOneSupply;
            const etherAmount1 = tokenAmount1 / BigInt(saleOnePrice);
            await ico.connect(addr1).buyTokens(tokenAmount1, zeroAddress, { value: etherAmount1 });

            // Check if the tokens were bought correctly
            expect(await ico.boughtTokensSaleOne(addr1.address)).to.equal(tokenAmount1);

            // Set the timestamp to be within SaleTwo
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoStart]);

            // Buy tokens with addr1
            const tokenAmount2 = saleTwoSupply;
            await ico.connect(addr1).buyTokens(tokenAmount2, zeroAddress, { value: tokenAmount2 / BigInt(saleTwoPrice) });

            // Check if the tokens were bought correctly
            expect(await ico.boughtTokensSaleTwo(addr1.address)).to.equal(tokenAmount2);

            // Set the timestamp to be within SaleThree
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleThreeStart]);

            // Buy tokens with addr1
            const tokenAmount3 = saleThreeSupply;
            await ico.connect(addr1).buyTokens(tokenAmount3, zeroAddress, { value: tokenAmount3 / BigInt(saleThreePrice) });

            // Check if the tokens were bought correctly
            expect(await ico.boughtTokensSaleThree(addr1.address)).to.equal(tokenAmount3);
        });

        it("Should not buy tokens outstide of sales period", async function () {
            // Test before saleOneStart, between saleOneEnd and saleTwoStart, and after saleTwoEnd
            const tokenAmount = ethers.parseEther((saleOnePrice * 10).toString());
            //WhiteList
            await ico.manageWhitelist([addr1.address], [true]);

            await ethers.provider.send("evm_setNextBlockTimestamp", [saleOneStart - 60 * 60 * 24 * 1]);
            await expect(ico.connect(addr1).buyTokens(tokenAmount, zeroAddress, { value: 10 })).to.be.revertedWith("Sale not active");
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleOneEnd + 60 * 60 * 24 * 1]);
            await expect(ico.connect(addr1).buyTokens(tokenAmount, zeroAddress, { value: 10 })).to.be.revertedWith("Sale not active");
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoEnd + 60 * 60 * 24 * 1]);
            await expect(ico.connect(addr1).buyTokens(tokenAmount, zeroAddress, { value: 10 })).to.be.revertedWith("Sale not active");
        });

        it("Should not buy tokens if not whitelisted", async function () {
            // Set the timestamp to be within SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleOneStart]);

            // Buy tokens with addr1
            const tokenAmount = ethers.parseEther((saleOnePrice * 10).toString());
            await expect(ico.connect(addr1).buyTokens(tokenAmount, zeroAddress, { value: tokenAmount / BigInt(saleOnePrice) }))
                .to.be.revertedWith("Not whitelisted");
        });

        it("Should not buy tokens if the sale supply is exceeded", async function () {
            // Set the timestamp to be within SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleOneStart]);

            // Add addr1 to the whitelist
            await ico.manageWhitelist([addr1.address], [true]);

            // Buy tokens with addr1
            const tokenAmount = saleOneSupply + BigInt(saleOnePrice);
            await expect(ico.connect(addr1).buyTokens(tokenAmount, zeroAddress, { value: tokenAmount / BigInt(saleOnePrice) }))
                .to.be.revertedWith("Insufficient remaining tokens supply");

            // Set the timestamp to be within SaleTwo
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoStart]);

            // Buy tokens with addr1
            const tokenAmount2 = saleTwoSupply + BigInt(saleOnePrice);
            await expect(ico.connect(addr1).buyTokens(tokenAmount2, zeroAddress, { value: tokenAmount2 / BigInt(saleTwoPrice) }))
                .to.be.revertedWith("Insufficient remaining tokens supply");

            // Set the timestamp to be within SaleThree
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleThreeStart]);

            // Buy tokens with addr1
            const tokenAmount3 = saleThreeSupply + BigInt(saleOnePrice);
            await expect(ico.connect(addr1).buyTokens(tokenAmount3, zeroAddress, { value: tokenAmount3 / BigInt(saleThreePrice) }))
                .to.be.revertedWith("Insufficient remaining tokens supply");
        });

        it("Should not buy tokens if the ether sent is wrong", async function () {
            // Set the timestamp to be within SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleOneStart]);

            // Add addr1 to the whitelist
            await ico.manageWhitelist([addr1.address], [true]);

            // Buy tokens with addr1
            const tokenAmount = ethers.parseEther((saleOnePrice * 10).toString());
            await expect(ico.connect(addr1).buyTokens(tokenAmount, zeroAddress,
                { value: (tokenAmount / BigInt(saleTwoPrice)) - 1n }))
                .to.be.revertedWith("Wrong amount of Ether sent");

            await expect(ico.connect(addr1).buyTokens(tokenAmount, zeroAddress,
                { value: (tokenAmount / BigInt(saleTwoPrice)) + 1n }))
                .to.be.revertedWith("Wrong amount of Ether sent");
        });

        it("Should not buy tokens if the amount is less than the minimum purchase", async function () {
            // Set the timestamp to be within SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleOneStart]);

            // Add addr1 to the whitelist
            await ico.manageWhitelist([addr1.address], [true]);

            // Buy tokens with addr1
            const tokenAmount = saleOneMinPurchase / 10n;
            await expect(ico.connect(addr1).buyTokens(tokenAmount, zeroAddress, { value: tokenAmount / BigInt(saleOnePrice) }))
                .to.be.revertedWith("Amount less than minimum purchase");

            // Set the timestamp to be within SaleTwo
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoStart]);

            // Buy tokens with addr1
            const tokenAmount2 = saleTwoMinPurchase / 10n;
            await expect(ico.connect(addr1).buyTokens(tokenAmount2, zeroAddress, { value: tokenAmount2 / BigInt(saleTwoPrice) }))
                .to.be.revertedWith("Amount less than minimum purchase");

            // Set the timestamp to be within SaleThree
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleThreeStart]);

            // Buy tokens with addr1
            const tokenAmount3 = saleThreeMinPurchase / 10n;
            await expect(ico.connect(addr1).buyTokens(tokenAmount3, zeroAddress, { value: tokenAmount3 / BigInt(saleThreePrice) }))
                .to.be.revertedWith("Amount less than minimum purchase");
        });

        it("Should give referral tokens if the referral address is not zero", async function () {
            // Set the timestamp to be within SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleOneStart]);

            // Add addr1 and addr2 to the whitelist
            await ico.manageWhitelist([addr1.address, addr2.address], [true, true]);

            // Buy tokens with addr1 (the referral)
            const tokenAmount = ethers.parseEther((saleOnePrice * 10).toString());
            await ico.connect(addr1).buyTokens(tokenAmount, zeroAddress, { value: tokenAmount / BigInt(saleOnePrice) });

            // Check that the owner received the referral tokens
            expect(await ico.totalReferralTokens()).to.equal(2n * (tokenAmount / referralRate));
            expect(await ico.referralTokens(addr1.address)).to.equal(0);
            expect(await ico.referralTokens(owner.address)).to.equal(2n * (tokenAmount / referralRate));

            // Buy tokens with addr2 (the referred)
            const tokenAmount2 = ethers.parseEther((saleOnePrice * 10).toString());
            await ico.connect(addr2).buyTokens(tokenAmount2, addr1.address, { value: tokenAmount2 / BigInt(saleOnePrice) });

            // Check that the referral tokens were given
            expect(await ico.totalReferralTokens()).to.equal(2n * (tokenAmount2 / referralRate) + 2n * (tokenAmount / referralRate));
            expect(await ico.referralTokens(addr1.address)).to.equal(tokenAmount2 / referralRate);
            expect(await ico.referralTokens(addr2.address)).to.equal(tokenAmount2 / referralRate);
        });

        it("Should not give referral tokens if the referral address did not buy tokens", async function () {
            // Set the timestamp to be within SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleOneStart]);

            // Add addr1 and addr2 to the whitelist
            await ico.manageWhitelist([addr1.address, addr2.address], [true, true]);

            // Buy tokens with addr2 (the referred)
            const tokenAmount = ethers.parseEther((saleOnePrice * 10).toString());
            expect(ico.connect(addr2).buyTokens(tokenAmount, addr1.address, { value: tokenAmount / BigInt(saleOnePrice) })).to.be.revertedWith("Referral has not bought tokens");
        });

        it("Should not give referral tokens if the referral address is not whitelisted", async function () {
            // Set the timestamp to be within SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleOneStart]);

            // Add addr1 to the whitelist
            await ico.manageWhitelist([addr1.address], [true]);

            // Buy tokens with addr1 (the referral)
            const tokenAmount = ethers.parseEther((saleOnePrice * 10).toString());
            await ico.connect(addr1).buyTokens(tokenAmount, zeroAddress, { value: tokenAmount / BigInt(saleOnePrice) });

            const expectedReferralTokens = 2n * tokenAmount / referralRate;

            // Check that no referral tokens were given to the user but to the owner
            expect(await ico.totalReferralTokens()).to.equal(expectedReferralTokens);
            expect(await ico.referralTokens(addr1.address)).to.equal(0);
            expect(await ico.referralTokens(owner.address)).to.equal(expectedReferralTokens);

            // Buy tokens with addr2 (the referred)
            const tokenAmount2 = ethers.parseEther((saleOnePrice * 10).toString());
            expect(ico.connect(addr2).buyTokens(tokenAmount2, addr1.address, { value: tokenAmount2 / BigInt(saleOnePrice) })).to.be.revertedWith("Referral not whitelisted");
        });
    });

    describe("Ending sales", function () {
        it("Should correctly end sale one if it succeeded", async function () {
            const paidEthers = await simulateSaleOne();

            // Set the timestamp to be between SaleOne and SaleTwo
            await ethers.provider.send("evm_setNextBlockTimestamp", [(saleOneEnd + saleTwoStart) / 2]);

            const saleOneBeforeEnd = await ico.saleOne();
            const contractBalanceBefore = await ethers.provider.getBalance(ico.target);
            const contractTokenBalanceBefore = await bearsRumble.balanceOf(ico.target);
            // End SaleOne
            await ico.endSale(1);

            const saleOneAfterEnd = await ico.saleOne();
            const contractBalanceAfter = await ethers.provider.getBalance(ico.target);
            const unsoldTokens = saleOneBeforeEnd[1] - saleOneBeforeEnd[2];
            const contractTokenBalanceAfter = await bearsRumble.balanceOf(ico.target);

            expect(saleOneAfterEnd[2]).to.equal(saleOneBeforeEnd[2]);
            expect(saleOneAfterEnd[7]).to.be.false;
            expect(saleOneAfterEnd[8]).to.be.true;
            expect(contractBalanceBefore - contractBalanceAfter).to.equal(paidEthers);
            expect(contractTokenBalanceBefore).to.equal(contractTokenBalanceAfter + unsoldTokens);

        });

        it("Should correctly end sale two if it succeeded", async function () {
            const paidEthers = await simulateSaleTwo();

            // Set the timestamp to be between SaleTwo and SaleThree
            await ethers.provider.send("evm_setNextBlockTimestamp", [(saleTwoEnd + saleThreeStart) / 2]);

            const saleTwoBeforeEnd = await ico.saleTwo();
            const contractBalanceBefore = await ethers.provider.getBalance(ico.target);
            const contractTokenBalanceBefore = await bearsRumble.balanceOf(ico.target);
            // End SaleTwo
            await ico.endSale(2);

            const saleTwoAfterEnd = await ico.saleTwo();
            const contractBalanceAfter = await ethers.provider.getBalance(ico.target);
            const unsoldTokens = saleTwoBeforeEnd[1] - saleTwoBeforeEnd[2];
            const contractTokenBalanceAfter = await bearsRumble.balanceOf(ico.target);

            expect(saleTwoAfterEnd[2]).to.equal(saleTwoBeforeEnd[2]);
            expect(saleTwoAfterEnd[7]).to.be.false;
            expect(saleTwoAfterEnd[8]).to.be.true;
            expect(contractBalanceBefore - contractBalanceAfter).to.equal(paidEthers);
            expect(contractTokenBalanceBefore).to.equal(contractTokenBalanceAfter + unsoldTokens);
        });

        it("Should correctly end sale three if it succeeded", async function () {
            const paidEthers = await simulateSaleThree();

            // Set the timestamp to be between SaleThree 
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleThreeEnd + 60 * 60 * 24 * 1]);

            const saleThreeBeforeEnd = await ico.saleThree();
            const contractBalanceBefore = await ethers.provider.getBalance(ico.target);
            const contractTokenBalanceBefore = await bearsRumble.balanceOf(ico.target);
            // End SaleThree
            await ico.endSale(3);

            const saleThreeAfterEnd = await ico.saleThree();
            const contractBalanceAfter = await ethers.provider.getBalance(ico.target);
            const unsoldTokens = saleThreeBeforeEnd[1] - saleThreeBeforeEnd[2];
            const contractTokenBalanceAfter = await bearsRumble.balanceOf(ico.target);

            expect(saleThreeAfterEnd[2]).to.equal(saleThreeBeforeEnd[2]);
            expect(saleThreeAfterEnd[7]).to.be.false;
            expect(saleThreeAfterEnd[8]).to.be.true;
            expect(contractBalanceBefore - contractBalanceAfter).to.equal(paidEthers);
            expect(contractTokenBalanceBefore).to.equal(contractTokenBalanceAfter + unsoldTokens);
        });

        it("Should correctly end sale one if it failed", async function () {
            // Set the timestamp to be after SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleOneEnd + 60 * 60 * 24 * 1]);

            const contractTokenBalanceBefore = await bearsRumble.balanceOf(ico.target);

            // End SaleOne
            await ico.endSale(1);

            const saleOne = await ico.saleOne();
            const contractTokenBalanceAfter = await bearsRumble.balanceOf(ico.target);

            expect(saleOne[7]).to.be.true;
            expect(saleOne[8]).to.be.true;
            expect(saleOne[2]).to.equal(0);
            expect(contractTokenBalanceBefore).to.equal(contractTokenBalanceAfter + saleOne[1]);
        });

        it("Should correctly end sale two if it failed", async function () {
            // Set the timestamp to be after SaleTwo
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoEnd + 60 * 60 * 24 * 1]);

            const contractTokenBalanceBefore = await bearsRumble.balanceOf(ico.target);

            // End SaleTwo
            await ico.endSale(2);

            const saleTwo = await ico.saleTwo();
            const contractTokenBalanceAfter = await bearsRumble.balanceOf(ico.target);

            expect(saleTwo[7]).to.be.true;
            expect(saleTwo[8]).to.be.true;
            expect(saleTwo[2]).to.equal(0);
            expect(contractTokenBalanceBefore).to.equal(contractTokenBalanceAfter + saleTwo[1]);
        });

        it("Should correctly end sale three if it failed", async function () {
            // Set the timestamp to be after SaleThree
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleThreeEnd + 60 * 60 * 24 * 1]);

            const contractTokenBalanceBefore = await bearsRumble.balanceOf(ico.target);

            // End SaleThree
            await ico.endSale(3);

            const saleThree = await ico.saleThree();
            const contractTokenBalanceAfter = await bearsRumble.balanceOf(ico.target);

            expect(saleThree[7]).to.be.true;
            expect(saleThree[8]).to.be.true;
            expect(saleThree[2]).to.equal(0);
            expect(contractTokenBalanceBefore).to.equal(contractTokenBalanceAfter + saleThree[1]);
        });

        it("Should not end sale if not the owner", async function () {
            // Set the timestamp to be between SaleOne and SaleTwo
            await ethers.provider.send("evm_setNextBlockTimestamp", [(saleOneEnd + saleTwoStart) / 2]);

            // End SaleOne
            await expect(ico.connect(addr1).endSale(1))
                .to.be.revertedWithCustomError(ico, "OwnableUnauthorizedAccount");
        });

        it("Should not end sale if the sale is not over", async function () {
            // Set the timestamp to be before SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleOneStart - 60 * 60 * 24 * 1]);

            // End SaleOne
            await expect(ico.endSale(1)).to.be.revertedWith("Sale One not ended yet");

            // Set the timestamp to be during SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleOneStart + 60 * 60 * 24 * 1]);

            // End SaleOne 
            await expect(ico.endSale(1)).to.be.revertedWith("Sale One not ended yet");

            // Set the timestamp to be during SaleTwo
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoStart + 60 * 60 * 24 * 1]);

            // End SaleTwo
            await expect(ico.endSale(2)).to.be.revertedWith("Sale Two not ended yet");

            // Set the timestamp to be during SaleThree
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleThreeStart + 60 * 60 * 24 * 1]);

            // End SaleThree
            await expect(ico.endSale(3)).to.be.revertedWith("Sale Three not ended yet");
        });

        it("Should not end sale if the sale has already ended", async function () {
            // Set the timestamp to be after all sales have ended
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleThreeEnd + 60 * 60 * 24 * 1]);

            // End sales
            await ico.endSale(1);
            await ico.endSale(2);
            await ico.endSale(3);

            await expect(ico.endSale(1)).to.be.revertedWith("Sale One already ended");
            await expect(ico.endSale(2)).to.be.revertedWith("Sale Two already ended");
            await expect(ico.endSale(3)).to.be.revertedWith("Sale Three already ended");
        });
    });

    describe("Claiming tokens", function () {
        it("Should claim tokens after the sale has ended", async function () {
            // Add addr1 to the whitelist
            await ico.manageWhitelist([addr1.address], [true]);

            // Set the timestamp to be within SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleOneStart + 60 * 60 * 24 * 1]);

            // Buy tokens with addr1
            const tokenAmountSaleOne = ethers.parseEther((saleOnePrice * 10).toString());
            await ico.connect(addr1).buyTokens(tokenAmountSaleOne, zeroAddress, { value: tokenAmountSaleOne / BigInt(saleOnePrice) });

            // Set the timestamp to be within SaleTwo
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoStart + 60 * 60 * 24 * 1]);
            await ico.endSale(1);

            // Buy tokens with addr1
            const tokenAmountSaleTwo = ethers.parseEther((saleTwoPrice * 10).toString());
            await ico.connect(addr1).buyTokens(tokenAmountSaleTwo, zeroAddress, { value: tokenAmountSaleTwo / BigInt(saleTwoPrice) });

            // Set the timestamp to be within SaleThree
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleThreeStart + 60 * 60 * 24 * 1]);

            // End SaleTwo
            await ico.endSale(2);

            // Buy tokens with addr1
            const tokenAmountSaleThree = ethers.parseEther((saleThreePrice * 500).toString());
            await ico.connect(addr1).buyTokens(tokenAmountSaleThree, zeroAddress, { value: tokenAmountSaleThree / BigInt(saleThreePrice) });

            // Set the timestamp to be after the sale has ended
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleThreeEnd + 60 * 60 * 24 * 1]);

            // End SaleThree
            await ico.endSale(3);

            // Set the timestamp to be after the cliff period and within the vesting period
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleThreeEnd + cliffPeriod + vestingPeriod / 2]);

            // Claim tokens with addr1
            const initialBalance = await bearsRumble.balanceOf(addr1.address);
            await ico.connect(addr1).claimTokens();
            const finalBalance = await bearsRumble.balanceOf(addr1.address);
            const claimedTokens = await ico.claimedTokens(addr1.address);
            const totalBoughtTokens = tokenAmountSaleOne + tokenAmountSaleTwo + tokenAmountSaleThree;
            // Check if the tokens were claimed correctly
            expect(finalBalance).to.equal(initialBalance + totalBoughtTokens / 2n);
            expect(claimedTokens).to.equal(totalBoughtTokens / 2n);
        });

        it("Should claim all tokens after the vesting period", async function () {
            // Set the timestamp to be within SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoStart + 60 * 60 * 24 * 1]);

            // Add addr1 to the whitelist
            await ico.manageWhitelist([addr1.address], [true]);

            // Buy tokens with addr1
            const tokenAmount = ethers.parseEther((saleTwoPrice * 10).toString());
            await ico.connect(addr1).buyTokens(tokenAmount, zeroAddress, { value: tokenAmount / BigInt(saleTwoPrice) });

            // Set the timestamp to be after the vesting period
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleThreeEnd + cliffPeriod + vestingPeriod]);

            // End SaleTwo
            await ico.endSale(2);

            // Claim tokens with addr1
            const initialBalance = await bearsRumble.balanceOf(addr1.address);
            await ico.connect(addr1).claimTokens();
            const finalBalance = await bearsRumble.balanceOf(addr1.address);
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
            await ico.connect(addr1).buyTokens(tokenAmount, zeroAddress, { value: tokenAmount / BigInt(saleTwoPrice) });

            // Set the timestamp to be within the cliff period
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoEnd + cliffPeriod / 2]);

            // Claim tokens with addr1
            await expect(ico.connect(addr1).claimTokens()).to.be.revertedWith("Claim period not started");
        });

        it("Should claim zero tokens if the address has already claimed all tokens", async function () {
            // Set the timestamp to be within SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoStart + 60 * 60 * 24 * 1]);

            // Add addr1 to the whitelist
            await ico.manageWhitelist([addr1.address], [true]);

            // Buy tokens with addr1
            const tokenAmount = ethers.parseEther((saleTwoPrice * 10).toString());
            await ico.connect(addr1).buyTokens(tokenAmount, zeroAddress, { value: tokenAmount / BigInt(saleTwoPrice) });

            // Set the timestamp to be after the cliff period and within the vesting period so all tokens are unlocked
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleThreeEnd + cliffPeriod + vestingPeriod + 1]);

            await ico.endSale(2);
            // Claim tokens with addr1
            await ico.connect(addr1).claimTokens();

            // Claim tokens with addr1 again
            await expect(ico.connect(addr1).claimTokens()).to.be.revertedWith("No claimable tokens");
        });

        it("Should add referral tokens to the total claimed tokens", async function () {
            // Set the timestamp to be within SaleTwo
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoStart + 60 * 60 * 24 * 1]);

            // Add addr1 and addr2 to the whitelist
            await ico.manageWhitelist([addr1.address, addr2.address], [true, true]);

            // Buy tokens with addr1 (the referral)
            const tokenAmount = ethers.parseEther((saleTwoPrice * 10).toString());
            await ico.connect(addr1).buyTokens(tokenAmount, zeroAddress, { value: tokenAmount / BigInt(saleTwoPrice) });

            // Buy tokens with addr2 (the referred)
            const tokenAmount2 = ethers.parseEther((saleTwoPrice * 10).toString());
            await ico.connect(addr2).buyTokens(tokenAmount2, addr1.address, { value: tokenAmount2 / BigInt(saleTwoPrice) });

            // Set the timestamp to be after the cliff period and within the vesting period
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleThreeEnd + cliffPeriod + vestingPeriod + 1]);

            await ico.endSale(2);
            // Claim tokens with addr2
            await ico.connect(addr2).claimTokens();

            const referralTokens = tokenAmount2 / referralRate;
            const claimedTokens = await ico.claimedTokens(addr2.address);

            // Check if the tokens were claimed correctly
            expect(claimedTokens).to.equal(tokenAmount2 + referralTokens);
            expect(await ico.referralTokens(addr2.address)).to.equal(referralTokens);
            expect(await ico.referralTokens(addr1.address)).to.equal(referralTokens);
        });
    });

    describe("Claiming refund", function () {

        async function simulateFailedSaleOne() {
            // Set the timestamp to be within SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleOneStart]);

            // Add addr1 to the whitelist
            await ico.manageWhitelist([addr1.address], [true]);

            // Buy tokens with addr1
            const tokenAmount = ethers.parseEther((saleOnePrice * 1).toString());
            const paidEthers = tokenAmount / BigInt(saleOnePrice);
            await ico.connect(addr1).buyTokens(tokenAmount, zeroAddress, { value: paidEthers });

            // Set the timestamp to be after SaleOne
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleOneEnd + 60 * 60 * 24 * 1]);

            // End SaleOne
            await ico.endSale(1);

            return paidEthers;
        }

        async function simulateFailedSaleTwo() {
            // Set the timestamp to be within SaleTwo
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoStart]);

            // Add addr1 to the whitelist
            await ico.manageWhitelist([addr1.address], [true]);

            // Buy tokens with addr1
            const tokenAmount = ethers.parseEther((saleTwoPrice * 1).toString());
            const paidEthers = tokenAmount / BigInt(saleTwoPrice);
            await ico.connect(addr1).buyTokens(tokenAmount, zeroAddress, { value: paidEthers });

            // Set the timestamp to be after SaleTwo
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleTwoEnd + 60 * 60 * 24 * 1]);

            // End SaleTwo
            await ico.endSale(2);

            return paidEthers;
        }

        async function simulateFailedSaleThree() {
            // Set the timestamp to be within SaleThree
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleThreeStart]);

            // Add addr1 to the whitelist
            await ico.manageWhitelist([addr1.address], [true]);

            // Buy tokens with addr1
            const tokenAmount = ethers.parseEther((saleThreePrice * 1).toString());
            const paidEthers = tokenAmount / BigInt(saleThreePrice);
            await ico.connect(addr1).buyTokens(tokenAmount, zeroAddress, { value: paidEthers });

            // Set the timestamp to be after SaleThree
            await ethers.provider.send("evm_setNextBlockTimestamp", [saleThreeEnd + 60 * 60 * 24 * 1]);

            // End SaleThree
            await ico.endSale(3);

            return paidEthers;
        }

        it("Should allow to claim ethers back after the sale has ended and failed", async function () {
            const paidEthersSaleOne = await simulateFailedSaleOne();
            const paidEthersSaleTwo = await simulateFailedSaleTwo();
            const paidEthersSaleThree = await simulateFailedSaleThree();

            const contractBalanceBefore = await ethers.provider.getBalance(ico.target);
            const userAddressBalanceBefore = await ethers.provider.getBalance(addr1.address);

            // Claim refund with addr1
            await ico.connect(addr1).claimRefund(1);
            await ico.connect(addr1).claimRefund(2);
            await ico.connect(addr1).claimRefund(3);

            const contractBalanceAfter = await ethers.provider.getBalance(ico.target);
            const userAddressBalanceAfter = await ethers.provider.getBalance(addr1.address);

            // Check if the ethers were refunded correctly
            expect(contractBalanceBefore - contractBalanceAfter).to.equal(paidEthersSaleOne + paidEthersSaleTwo + paidEthersSaleThree);
            expect(userAddressBalanceAfter).to.be.gt(userAddressBalanceBefore);
        });

        it("Should not allow to claim ethers back if refunds are not active", async function () {
            await simulateSaleOne();
            await simulateSaleTwo();
            await simulateSaleThree();

            // Try to claim refund with addr1
            await expect(ico.connect(addr1).claimRefund(1)).to.be.revertedWith("Refund not active");
            await expect(ico.connect(addr1).claimRefund(2)).to.be.revertedWith("Refund not active");
            await expect(ico.connect(addr1).claimRefund(3)).to.be.revertedWith("Refund not active");
        });

        it("Should not allow to claim ethers back if the user has already claimed the refund", async function () {
            await simulateFailedSaleOne();
            await simulateFailedSaleTwo();
            await simulateFailedSaleThree();

            // Claim refund with addr1
            await ico.connect(addr1).claimRefund(1);
            await ico.connect(addr1).claimRefund(2);
            await ico.connect(addr1).claimRefund(3);

            // Try to claim refund with addr1 again
            await expect(ico.connect(addr1).claimRefund(1)).to.be.revertedWith("No ethers to refund");
            await expect(ico.connect(addr1).claimRefund(2)).to.be.revertedWith("No ethers to refund");
            await expect(ico.connect(addr1).claimRefund(3)).to.be.revertedWith("No ethers to refund");
        });

    });

    describe("Complete ICO simulation", function () {
        it("Should simulate the complete ICO process", async function () {
            const paidEtherInSales = await simulateCompleteICO();
            const ownerETHBalance = await ethers.provider.getBalance(owner.address);
        });
    });

    describe("Pause and Unpause", function () {
        it("Should pause and unpause the contract", async function () {
            // Pause the contract
            await ico.pause();

            // Check if the contract is paused
            expect(await ico.paused()).to.be.true;

            // Unpause the contract
            await ico.unpause();

            // Check if the contract is unpaused
            expect(await ico.paused()).to.be.false;
        });

        it("Should not pause and unpause the contract if not the owner", async function () {
            // Pause the contract
            await expect(ico.connect(addr1).pause())
                .to.be.revertedWithCustomError(ico, "OwnableUnauthorizedAccount");

            // Unpause the contract
            await expect(ico.connect(addr1).unpause())
                .to.be.revertedWithCustomError(ico, "OwnableUnauthorizedAccount");
        });
    });

    describe("Update refferal rate", function () {
        it("Should update refferal rate", async function () {
            const newReferralRate = 5;
            await ico.updateReferralRate(newReferralRate);
            expect(await ico.referralRate()).to.equal(newReferralRate);
        });

        it("Should not update refferal rate if not the owner", async function () {
            await expect(ico.connect(addr1).updateReferralRate(5))
                .to.be.revertedWithCustomError(ico, "OwnableUnauthorizedAccount");
        });
    });
});
