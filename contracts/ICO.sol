// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {BearRumble} from "./BearRumble.sol";

/**
 * @title  ICO Contract
 * @author IARD Solutions: https://iard.solutions - Web3 Experts suited to your needs
 * @notice This contract is used to manage the ICO of the BearRumble token
 *         The ICO has two sales, a cliff period and a vesting period
 *         The owner can manage the whitelist, end the sale and burn the unsold tokens
 *         The buyers can buy tokens and claim them after the vesting period
 */

contract ICO is Ownable, ReentrancyGuard {
    BearRumble token;

    /**
     * @notice Sale details
     * @param price Price of the token in tokens per Ether
     * @param tokenSupply Total supply of tokens for the sale in the smallest unit of the token
     * @param soldTokens Amount of tokens sold in the smallest unit of the token
     * @param minPurchase Minimum purchase in the smallest unit of the token
     * @param startTime Timestamp of the start of the sale in seconds
     * @param endTime Timestamp of the end of the sale in seconds
     */
    struct Sale {
        uint256 price;
        uint256 tokenSupply;
        uint256 soldTokens;
        uint256 minPurchase;
        uint256 startTime;
        uint256 endTime;
    }

    /**
     * @notice Enum for the sale stages
     * @param BeforeStart ICO not started yet
     * @param SaleOne First sale
     * @param BetweenSaleOneAndTwo Between sale one and two
     * @param SaleTwo Second sale
     * @param CliffPeriod Cliff period
     * @param VestingPeriod Vesting period
     * @param Ended ICO ended
     */
    enum SaleStages {
        BeforeStart,
        SaleOne,
        BetweenSaleOneAndTwo,
        SaleTwo,
        CliffPeriod,
        VestingPeriod,
        Ended
    }
    SaleStages public saleStage;

    // Sale details
    Sale public saleOne;
    Sale public saleTwo;

    // Whitelist, true if the address is whitelisted. Only whitelisted addresses can buy tokens
    mapping(address => bool) public whitelist;

    // Vesting
    // Cliff period in seconds
    uint256 public cliffPeriod;

    // Vesting period in seconds
    // 0% of the tokens will be claimable at the start of the vesting period and 100% at the end, linearly unlocking over the period
    uint256 public vestingPeriod;

    // Token tracking
    mapping(address => uint256) public boughtTokens;
    mapping(address => uint256) public claimedTokens;

    // Events
    event TokenPurchased(address buyer, uint256 amount, uint256 price);
    event TokenClaimed(address claimer, uint256 amount);
    event SaleStageChanged(SaleStages newStage);
    event TokenBurned(uint256 amount);

    constructor(
        address _token,
        Sale memory _saleOne,
        Sale memory _saleTwo,
        uint256 _cliffPeriod,
        uint256 _vestingPeriod
    ) Ownable(msg.sender) {
        token = BearRumble(_token);

        saleOne.price = _saleOne.price;
        saleOne.tokenSupply = _saleOne.tokenSupply;
        saleOne.minPurchase = _saleOne.minPurchase;
        saleOne.startTime = _saleOne.startTime;
        saleOne.endTime = _saleOne.endTime;

        saleTwo.price = _saleTwo.price;
        saleTwo.tokenSupply = _saleTwo.tokenSupply;
        saleTwo.minPurchase = _saleTwo.minPurchase;
        saleTwo.startTime = _saleTwo.startTime;
        saleTwo.endTime = _saleTwo.endTime;

        cliffPeriod = _cliffPeriod;
        vestingPeriod = _vestingPeriod;

        saleOne.soldTokens = 0;
        saleTwo.soldTokens = 0;

        whitelist[msg.sender] = true;
    }

    /************************************ External functions ************************************/

    /**
     * @notice Buy tokens from the ICO
     * @param _amount Amount of tokens to buy in the smallest unit of the token
     */
    function buyTokens(
        uint256 _amount
    ) external payable onlyWhiteListed nonReentrant {
        setSaleStage();

        // Calculate the token price based on the current sale stage
        uint256 price;
        if (saleStage == SaleStages.SaleOne) {
            price = saleOne.price;
        } else if (saleStage == SaleStages.SaleTwo) {
            price = saleTwo.price;
        } else {
            revert("Sale not active");
        }

        // Check if the buyer has sent enough Ether to purchase the tokens
        require(msg.value == _amount / price, "Wrong amount of Ether sent");

        // Check if the amount is greater than the minimum purchase
        if (saleStage == SaleStages.SaleOne) {
            require(
                _amount >= saleOne.minPurchase,
                "Amount less than minimum purchase"
            );
        } else if (saleStage == SaleStages.SaleTwo) {
            require(
                _amount >= saleTwo.minPurchase,
                "Amount less than minimum purchase"
            );
        }

        //Check if enough tokens are available for the sale and update the sold tokens
        if (saleStage == SaleStages.SaleOne) {
            require(
                saleOne.soldTokens + _amount <= saleOne.tokenSupply,
                "Insufficient remaining tokens supply"
            );
            saleOne.soldTokens += _amount;
        } else if (saleStage == SaleStages.SaleTwo) {
            require(
                saleTwo.soldTokens + _amount <= saleTwo.tokenSupply,
                "Insufficient remaining tokens supply"
            );
            saleTwo.soldTokens += _amount;
        }

        // Register the bought tokens
        boughtTokens[msg.sender] += _amount;

        // Emit the TokenPurchased event
        emit TokenPurchased(msg.sender, _amount, price);
    }

    function claimTokens() external onlyWhiteListed nonReentrant {
        setSaleStage();
        require(
            saleStage == SaleStages.VestingPeriod ||
                saleStage == SaleStages.Ended,
            "Claim period not started"
        );

        uint256 currentTime = block.timestamp;

        uint256 claimableTokens = 0;
        uint256 unlockedTokens = 0;

        if (saleStage == SaleStages.VestingPeriod) {
            unlockedTokens =
                (boughtTokens[msg.sender] *
                    (currentTime - saleTwo.endTime - cliffPeriod)) /
                vestingPeriod;
        } else if (saleStage == SaleStages.Ended) {
            unlockedTokens = boughtTokens[msg.sender];
        }

        if (unlockedTokens > claimedTokens[msg.sender]) {
            claimableTokens = unlockedTokens - claimedTokens[msg.sender];
        } else {
            revert("No claimable tokens");
        }

        claimedTokens[msg.sender] = unlockedTokens;

        token.transfer(msg.sender, claimableTokens);

        emit TokenClaimed(msg.sender, claimableTokens);
    }

    /************************************ Owner functions ************************************/

    function burnUnsoldTokens() public onlyOwner {
        setSaleStage();

        require(
            saleStage == SaleStages.CliffPeriod ||
                saleStage == SaleStages.VestingPeriod ||
                saleStage == SaleStages.Ended,
            "Sale not ended"
        );

        uint256 unsoldTokensSaleOne = saleOne.tokenSupply - saleOne.soldTokens;
        uint256 unsoldTokensSaleTwo = saleTwo.tokenSupply - saleTwo.soldTokens;
        uint256 unsoldTokens = unsoldTokensSaleOne + unsoldTokensSaleTwo;

        if (unsoldTokens != 0) {
            token.burn(unsoldTokens);
            emit TokenBurned(unsoldTokens);
        }
    }

    function manageWhitelist(
        address[] calldata _addresses,
        bool[] calldata _isWhitelisted
    ) external onlyOwner {
        require(
            _addresses.length == _isWhitelisted.length,
            "Arrays length mismatch"
        );
        for (uint256 i = 0; i < _addresses.length; i++) {
            whitelist[_addresses[i]] = _isWhitelisted[i];
        }
    }

    function endSale() external onlyOwner {
        setSaleStage();
        require(
            saleStage == SaleStages.BetweenSaleOneAndTwo ||
                saleStage > SaleStages.SaleTwo,
            "Cannot end the sale yet"
        );

        if (saleStage == SaleStages.BetweenSaleOneAndTwo) {
            // After sale one, move the unsold tokens from sale one to sale two
            uint256 unsoldTokensSaleOne = saleOne.tokenSupply -
                saleOne.soldTokens;
            saleTwo.tokenSupply += unsoldTokensSaleOne;
            saleOne.tokenSupply = saleOne.soldTokens;

            // Send the sale benefits to the owner
            payable(owner()).transfer(address(this).balance);
        } else {
            // After sale two, burn the unsold tokens
            burnUnsoldTokens();

            // Send the sale benefits to the owner
            payable(owner()).transfer(address(this).balance);
        }
    }

    /************************************ Internal functions ************************************/

    function setSaleStage() internal {
        uint256 currentTime = block.timestamp;

        if (currentTime < saleOne.startTime) {
            saleStage = SaleStages.BeforeStart;
        } else if (
            currentTime >= saleOne.startTime && currentTime <= saleOne.endTime
        ) {
            saleStage = SaleStages.SaleOne;
        } else if (
            currentTime > saleOne.endTime && currentTime < saleTwo.startTime
        ) {
            saleStage = SaleStages.BetweenSaleOneAndTwo;
        } else if (
            currentTime >= saleTwo.startTime && currentTime < saleTwo.endTime
        ) {
            saleStage = SaleStages.SaleTwo;
        } else if (
            currentTime >= saleTwo.endTime &&
            currentTime < saleTwo.endTime + cliffPeriod
        ) {
            saleStage = SaleStages.CliffPeriod;
        } else if (
            currentTime >= saleTwo.endTime + cliffPeriod &&
            currentTime < saleTwo.endTime + cliffPeriod + vestingPeriod
        ) {
            saleStage = SaleStages.VestingPeriod;
        } else {
            saleStage = SaleStages.Ended;
        }
    }

    /************************************ Modifiers functions ************************************/

    modifier onlyWhiteListed() {
        require(whitelist[msg.sender], "Not whitelisted");
        _;
    }
}
