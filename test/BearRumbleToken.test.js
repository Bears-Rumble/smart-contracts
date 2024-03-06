const { ethers } = require("hardhat");
const { expect } = require("chai");

describe.only("BearRumbleToken", function() {

    let BearRumbleToken, bearRumbleToken, owner, addr1, addr2;

    beforeEach(async function() {
        BearRumbleToken = await ethers.getContractFactory("BearRumble");
        [owner, addr1, addr2] = await ethers.getSigners();
        bearRumbleToken = await BearRumbleToken.deploy();
    });

    describe("Deployment", function() {
        it("Should set the parameters", async function() {
            expect(await bearRumbleToken.name()).to.equal("BearRumble");
            expect(await bearRumbleToken.symbol()).to.equal("BR");
            expect(await bearRumbleToken.balanceOf(owner.address))
                .to.equal(1_000_000_000n * 10n ** 18n);
            expect(await bearRumbleToken.totalSupply())
                .to.equal(1_000_000_000n * 10n ** 18n);
        });
        
    });

});