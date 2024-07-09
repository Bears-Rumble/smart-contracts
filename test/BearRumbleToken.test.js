const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("BearsRumbleToken", function() {

    let BearsRumbleToken, bearsRumbleToken, owner, addr1, addr2;

    beforeEach(async function() {
        BearsRumbleToken = await ethers.getContractFactory("BearsRumble");
        [owner, addr1, addr2] = await ethers.getSigners();
        bearsRumbleToken = await BearsRumbleToken.deploy();
    });

    describe("Deployment", function() {
        it("Should set the parameters", async function() {
            expect(await bearsRumbleToken.name()).to.equal("BearsRumble");
            expect(await bearsRumbleToken.symbol()).to.equal("BR");
            expect(await bearsRumbleToken.balanceOf(owner.address))
                .to.equal(1_000_000_000n * 10n ** 18n);
            expect(await bearsRumbleToken.totalSupply())
                .to.equal(1_000_000_000n * 10n ** 18n);
        });
        
    });

});