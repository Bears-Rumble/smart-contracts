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
        CliffPeriod,
        VestingPeriod,
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
        if (saleStage == SaleStage.SaleOne) {
            price = saleOnePrice;
        } else if (saleStage == SaleStage.SaleTwo) {
            price = saleTwoPrice;
        } else {
            revert("Sale not active");
        }

        // Check if the buyer has sent enough Ether to purchase the tokens
        require(msg.value == _amount / price, "Wrong amount of Ether sent");

        //Send ETH to the owner
        payable(owner()).transfer(msg.value);

        //Check if enough tokens are available for the sale and update the sold tokens
        if (saleStage == SaleStage.SaleOne) {
            require(
                saleOneSoldTokens + _amount <= saleOneTokenSupply,
                "Insufficient remaining tokens supply"
            );
            saleOneSoldTokens += _amount;
        } else if (saleStage == SaleStage.SaleTwo) {
            require(
                saleTwoSoldTokens + _amount <= saleTwoTokenSupply,
                "Insufficient remaining tokens supply"
            );
            saleTwoSoldTokens += _amount;
        }

        // Register the bought tokens
        boughtTokens[msg.sender] += _amount;

        // Emit the TokenPurchased event
        emit TokenPurchased(msg.sender, _amount, price);
    }

    function claimTokens() external onlyWhiteListed nonReentrant {
        setSaleStage();
        require(
            saleStage == SaleStage.VestingPeriod ||
                saleStage == SaleStage.Ended,
            "Claim period not started"
        );

        uint256 currentTime = block.timestamp;

        uint256 claimableTokens = 0;
        uint256 unlockedTokens = 0;

        if (saleStage == SaleStage.VestingPeriod) {
            unlockedTokens =
                (boughtTokens[msg.sender] *
                    (currentTime - saleTwoEndTime - cliffPeriod)) /
                vestingPeriod;
        } else if (saleStage == SaleStage.Ended) {
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

    function burnUnsoldTokens() external onlyOwner {
        setSaleStage();

        require(
            saleStage == SaleStage.CliffPeriod ||
                saleStage == SaleStage.VestingPeriod ||
                saleStage == SaleStage.Ended,
            "Sale not ended"
        );

        uint256 unsoldTokensSaleOne = saleOneTokenSupply - saleOneSoldTokens;
        uint256 unsoldTokensSaleTwo = saleTwoTokenSupply - saleTwoSoldTokens;
        uint256 unsoldTokens = unsoldTokensSaleOne + unsoldTokensSaleTwo;
        
        token.burn(unsoldTokens);

        emit TokenBurned(unsoldTokens);
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

    /************************************ Internal functions ************************************/

    function setSaleStage() internal {
        uint256 currentTime = block.timestamp;

        if (
            currentTime < saleOneStartTime ||
            (currentTime > saleOneEndTime && currentTime < saleTwoStartTime)
        ) {
            saleStage = SaleStage.BeforeStart;
        } else if (
            currentTime >= saleOneStartTime && currentTime <= saleOneEndTime
        ) {
            saleStage = SaleStage.SaleOne;
        } else if (
            currentTime >= saleTwoStartTime && currentTime < saleTwoEndTime
        ) {
            saleStage = SaleStage.SaleTwo;
        } else if (
            currentTime >= saleTwoEndTime &&
            currentTime < saleTwoEndTime + cliffPeriod
        ) {
            saleStage = SaleStage.CliffPeriod;
        } else if (
            currentTime >= saleTwoEndTime + cliffPeriod &&
            currentTime < saleTwoEndTime + cliffPeriod + vestingPeriod
        ) {
            saleStage = SaleStage.VestingPeriod;
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
