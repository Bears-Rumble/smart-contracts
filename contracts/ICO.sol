// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {BearRumble} from "./BearRumble.sol";

contract ICO is Ownable, ReentrancyGuard {
    BearRumble token;

    // Sale stages
    enum SaleStage {
        BeforeStart,
        SaleOne,
        SaleTwo,
        Ended
    }
    SaleStage public saleStage;

    // Sale details

    // Price of the token in tokens per Ether
    // Example: 1 ETH = 1000 tokens, then the price is 1000
    uint256 public saleOnePrice;
    uint256 public saleTwoPrice;

    // Total token supply for each sale
    uint256 public saleOneTokenSupply;
    uint256 public saleTwoTokenSupply;

    uint256 public saleOneSoldTokens;
    uint256 public saleTwoSoldTokens;

    // Timestamps for each sale stage
    uint256 public saleOneStartTime;
    uint256 public saleOneEndTime;
    uint256 public saleTwoStartTime;
    uint256 public saleTwoEndTime;

    // Whitelist, true if the address is whitelisted
    mapping(address => bool) public whitelist;

    // Vesting
    // Cliff period in seconds
    uint256 public cliffPeriod;
    // Vesting period in seconds
    // 0% of the tokens will be claimable at the start of the vesting period and 100% at the end
    uint256 public vestingPeriod;

    // Token tracking
    mapping(address => uint256) public boughtTokens;
    mapping(address => uint256) public claimedTokens;

    // Events
    event TokenPurchased(address buyer, uint256 amount, uint256 price);
    event TokenClaimed(address claimer, uint256 amount);
    event SaleStageChanged(SaleStage newStage);
    event TokenBurned(uint256 amount);

    constructor(
        address _token,
        uint256 _saleOnePrice,
        uint256 _saleTwoPrice,
        uint256 _saleOneTokenSupply,
        uint256 _saleTwoTokenSupply,
        uint256 _saleOneStartTime,
        uint256 _saleOneEndTime,
        uint256 _saleTwoStartTime,
        uint256 _saleTwoEndTime,
        uint256 _cliffPeriod,
        uint256 _vestingPeriod
    ) Ownable(msg.sender) {
        token = BearRumble(_token);
        saleOnePrice = _saleOnePrice;
        saleTwoPrice = _saleTwoPrice;
        saleOneTokenSupply = _saleOneTokenSupply;
        saleTwoTokenSupply = _saleTwoTokenSupply;
        saleOneStartTime = _saleOneStartTime;
        saleOneEndTime = _saleOneEndTime;
        saleTwoStartTime = _saleTwoStartTime;
        saleTwoEndTime = _saleTwoEndTime;
        cliffPeriod = _cliffPeriod;
        vestingPeriod = _vestingPeriod;

        saleOneSoldTokens = 0;
        saleTwoSoldTokens = 0;
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
        if (saleStage == SaleStage.SaleOne) {
            price = saleOnePrice;
        } else if (saleStage == SaleStage.SaleTwo) {
            price = saleTwoPrice;
        } else {
            revert("Sale not active");
        }

        // Check if the buyer has sent enough Ether to purchase the tokens
        require(msg.value >= price * _amount, "Insufficient Ether");

        //Send ETH to the owner
        payable(owner()).transfer(msg.value);

        //Check if enough tokens are available for the sale and update the sold tokens
        if (saleStage == SaleStage.SaleOne) {
            require(
                saleOneSoldTokens + _amount <= saleOneTokenSupply,
                "Insufficient remaining tokens"
            );
            saleOneSoldTokens += _amount;
        } else if (saleStage == SaleStage.SaleTwo) {
            require(
                saleTwoSoldTokens + _amount <= saleTwoTokenSupply,
                "Insufficient remaining tokens"
            );
            saleTwoSoldTokens += _amount;
        }

        // Register the bought tokens
        boughtTokens[msg.sender] += _amount;

        // Emit the TokenPurchased event
        emit TokenPurchased(msg.sender, _amount, price);
    }

    function claimTokens() external onlyWhiteListed nonReentrant {
        require(saleStage == SaleStage.Ended, "Sale not ended");

        uint256 currentTime = block.timestamp;

        require(
            currentTime > saleTwoEndTime + cliffPeriod,
            "Claim period not started"
        );
        uint256 claimableTokens = 0;
        uint256 unlockedTokens = 0;
        if (currentTime < saleTwoEndTime + vestingPeriod) {
            unlockedTokens =
                (boughtTokens[msg.sender] * (currentTime - saleTwoEndTime)) /
                vestingPeriod;
        } else {
            unlockedTokens = boughtTokens[msg.sender];
        }

        if (unlockedTokens > claimedTokens[msg.sender]) {
            claimableTokens = unlockedTokens - claimedTokens[msg.sender];
        }

        require(claimableTokens > 0, "No claimable tokens");

        token.transfer(msg.sender, claimableTokens);

        emit TokenClaimed(msg.sender, claimableTokens);
    }

    /************************************ Owner functions ************************************/

    function burnUnsoldTokens() external onlyOwner {
        setSaleStage();

        require(saleStage == SaleStage.Ended, "Sale not ended");

        uint256 unsoldTokens = token.balanceOf(address(this));
        token.burn(unsoldTokens);
    }

    function addToWhitelist(address[] calldata _addresses) external onlyOwner {
        for (uint256 i = 0; i < _addresses.length; i++) {
            whitelist[_addresses[i]] = true;
        }
    }

    /************************************ Internal functions ************************************/

    function setSaleStage() internal {
        uint256 currentTime = block.timestamp;

        if (currentTime < saleOneStartTime) {
            saleStage = SaleStage.BeforeStart;
        } else if (
            currentTime >= saleOneStartTime && currentTime <= saleOneEndTime
        ) {
            saleStage = SaleStage.SaleOne;
        } else if (
            currentTime >= saleTwoStartTime && currentTime <= saleTwoEndTime
        ) {
            saleStage = SaleStage.SaleTwo;
        } else {
            saleStage = SaleStage.Ended;
        }
    }

    /************************************ Modifiers functions ************************************/

    modifier onlyWhiteListed() {
        require(whitelist[msg.sender], "Not whitelisted");
        _;
    }
}
