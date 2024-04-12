// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import {BearRumble} from "./BearRumble.sol";

/**
 * @title  Bear Rumble ICO Contract
 * @author IARD Solutions: https://iard.solutions - Web3 Experts suited to your needs. Web3 | Consulting | Innovations
 * @author Bear Rumble: 
 * @notice This contract is used to manage the ICO of the BearRumble token
 *         The ICO has three sales, a cliff period and a vesting period
 *         The owner can manage the whitelist, end the sale and burn the unsold tokens
 *         The buyers can buy tokens and claim them after the vesting period
 *         If a sale ends and the minimum tokens are not sold, the buyers can claim a refund
 *
 * Important notes:
 * - The Sold ERC20 token total supply must be sent to this contract address before the first sale starts
 *
 *  BearRumble is a Play2Earn & Free2Play multiplayer Web3 Game
 *  Socials:
 *  - Website:
 *  - Twitter:
 *  - Telegram:
 *  - Discord:
 */

contract ICO is Ownable, ReentrancyGuard, Pausable {

    /**
     * @notice Sale details
     * @param price Price of the token in tokens per Ether
     * @param tokenSupply Total supply of tokens for the sale in the smallest unit of the token
     * @param soldTokens Amount of tokens sold in the smallest unit of the token
     * @param minPurchase Minimum purchase in the smallest unit of the token
     * @param startTime Timestamp of the start of the sale in seconds
     * @param endTime Timestamp of the end of the sale in seconds
     * @param minSoldTokens Minimum amount of tokens to be sold for the sale to be successful
     * @param isRefundActive True if the refund mechanism is active
     * @param isEnded True if the sale has ended
     */
    struct Sale {
        uint256 price;
        uint256 tokenSupply;
        uint256 soldTokens;
        uint256 minPurchase;
        uint256 startTime;
        uint256 endTime;
        uint256 minSoldTokens;
        bool isRefundActive;
        bool isEnded;
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
        BetweenSaleTwoAndThree,
        SaleThree,
        CliffPeriod,
        VestingPeriod,
        Ended
    }

    BearRumble public immutable token;

    SaleStages public saleStage;

    // Sale details
    Sale public saleOne;
    Sale public saleTwo;
    Sale public saleThree;

    // Whitelist, true if the address is whitelisted. Only whitelisted addresses can buy tokens
    mapping(address => bool) public whitelist;

    // Vesting
    // Cliff period in seconds
    uint256 public immutable cliffPeriod;

    // Vesting period in seconds
    // 0% of the tokens will be claimable at the start of the vesting period and 100% at the end, linearly unlocking over the period
    uint256 public immutable vestingPeriod;

    // Token tracking
    mapping(address => uint256) public boughtTokensSaleOne;
    mapping(address => uint256) public boughtTokensSaleTwo;
    mapping(address => uint256) public boughtTokensSaleThree;

    mapping(address => uint256) public claimedTokens;

    // Events
    event TokenPurchased(address buyer, uint256 amount, uint256 price);
    event TokenClaimed(address claimer, uint256 amount);
    event SaleStageChanged(SaleStages newStage);
    event TokenBurned(uint256 amount);
    event RefundClaimed(address claimer, uint256 amount);
    event SaleEnded(uint256 saleNumber);

    constructor(
        address _token,
        Sale memory _saleOne,
        Sale memory _saleTwo,
        Sale memory _saleThree,
        uint256 _cliffPeriod,
        uint256 _vestingPeriod
    ) Ownable(msg.sender) {
        token = BearRumble(_token);

        saleOne.price = _saleOne.price;
        saleOne.tokenSupply = _saleOne.tokenSupply;
        saleOne.soldTokens = 0;
        saleOne.minPurchase = _saleOne.minPurchase;
        saleOne.startTime = _saleOne.startTime;
        saleOne.endTime = _saleOne.endTime;
        saleOne.minSoldTokens = _saleOne.minSoldTokens;
        saleOne.isRefundActive = false;
        saleOne.isEnded = false;

        saleTwo.price = _saleTwo.price;
        saleTwo.tokenSupply = _saleTwo.tokenSupply;
        saleTwo.soldTokens = 0;
        saleTwo.minPurchase = _saleTwo.minPurchase;
        saleTwo.startTime = _saleTwo.startTime;
        saleTwo.endTime = _saleTwo.endTime;
        saleTwo.minSoldTokens = _saleTwo.minSoldTokens;
        saleTwo.isRefundActive = false;
        saleTwo.isEnded = false;

        saleThree.price = _saleThree.price;
        saleThree.tokenSupply = _saleThree.tokenSupply;
        saleThree.soldTokens = 0;
        saleThree.minPurchase = _saleThree.minPurchase;
        saleThree.startTime = _saleThree.startTime;
        saleThree.endTime = _saleThree.endTime;
        saleThree.minSoldTokens = _saleThree.minSoldTokens;
        saleThree.isRefundActive = false;
        saleThree.isEnded = false;

        cliffPeriod = _cliffPeriod;
        vestingPeriod = _vestingPeriod;

        whitelist[msg.sender] = true;
    }

    /************************************ External users functions ************************************/

    /**
     * @notice Buy tokens from the ICO
     * @param _amount Amount of tokens to buy in the smallest unit of the token
     */
    function buyTokens(
        uint256 _amount
    ) external payable onlyWhiteListed nonReentrant whenNotPaused setSaleStage {
        // Calculate the token price based on the current sale stage
        uint256 price = 0;
        if (saleStage == SaleStages.SaleOne) {
            price = saleOne.price;
        } else if (saleStage == SaleStages.SaleTwo) {
            price = saleTwo.price;
        } else if (saleStage == SaleStages.SaleThree) {
            price = saleThree.price;
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
        } else if (saleStage == SaleStages.SaleThree) {
            require(
                _amount >= saleThree.minPurchase,
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
            boughtTokensSaleOne[msg.sender] += _amount;
        } else if (saleStage == SaleStages.SaleTwo) {
            require(
                saleTwo.soldTokens + _amount <= saleTwo.tokenSupply,
                "Insufficient remaining tokens supply"
            );
            saleTwo.soldTokens += _amount;
            boughtTokensSaleTwo[msg.sender] += _amount;
        } else if (saleStage == SaleStages.SaleThree) {
            require(
                saleThree.soldTokens + _amount <= saleThree.tokenSupply,
                "Insufficient remaining tokens supply"
            );
            saleThree.soldTokens += _amount;
            boughtTokensSaleThree[msg.sender] += _amount;
        }

        // Emit the TokenPurchased event
        emit TokenPurchased(msg.sender, _amount, price);
    }

    /**
     * @dev Allows users to claim their tokens during the vesting period or after the ICO has ended.
     * @notice The claimable tokens are calculated based on the user's bought tokens, vesting period, and cliff period.
     * @notice The claimed tokens are updated for the user and the claimable tokens are transferred to the user's address.
     * @notice No need to check if the user has been whitelisted as the claimable tokens are based on the bought tokens.
     *  Also, it avoids giving the owner the ability to ban users after they bought tokens.
     */
    function claimTokens() external nonReentrant whenNotPaused setSaleStage {
        require(
            saleStage == SaleStages.VestingPeriod ||
                saleStage == SaleStages.Ended,
            "Claim period not started"
        );

        uint256 currentTime = block.timestamp;

        uint256 claimableTokens = 0;
        uint256 unlockedTokens = 0;
        uint256 boughtTokens = 0;

        // Calculate the total bought tokens for the user. Sale must be ended and refund not active
        if (!saleOne.isRefundActive && saleOne.isEnded)
            boughtTokens += boughtTokensSaleOne[msg.sender];
        if (!saleTwo.isRefundActive && saleTwo.isEnded)
            boughtTokens += boughtTokensSaleTwo[msg.sender];
        if (!saleThree.isRefundActive && saleThree.isEnded)
            boughtTokens += boughtTokensSaleThree[msg.sender];

        if (saleStage == SaleStages.VestingPeriod) {
            // Calculate the number of tokens that can be claimed based on the vesting period using the ratio of the current elapsed time to the vesting period
            unlockedTokens =
                (boughtTokens *
                    (currentTime - saleThree.endTime - cliffPeriod)) /
                vestingPeriod;
        } else if (saleStage == SaleStages.Ended) {
            unlockedTokens = boughtTokens;
        }

        if (unlockedTokens > claimedTokens[msg.sender]) {
            // Calculate the number of tokens that can be claimed based on the bought tokens and the already claimed tokens
            claimableTokens = unlockedTokens - claimedTokens[msg.sender];
        } else {
            revert("No claimable tokens");
        }

        emit TokenClaimed(msg.sender, claimableTokens);
        
        claimedTokens[msg.sender] = unlockedTokens;

        bool result = token.transfer(msg.sender, claimableTokens);
        require(result, "Transfer failed");
    }

    function claimRefund(
        uint256 _saleToRefund
    )
        external
        nonReentrant
        whenNotPaused
        setSaleStage
        saleMustExist(_saleToRefund)
    {
        uint256 refundAmount = 0;
        if (_saleToRefund == 1) {
            require(saleOne.isRefundActive, "Refund not active");
            require(boughtTokensSaleOne[msg.sender] > 0, "No ethers to refund");
            refundAmount = boughtTokensSaleOne[msg.sender] / saleOne.price; // Calculate the amount of Ether to refund based on the bought tokens and the token price
            boughtTokensSaleOne[msg.sender] = 0; // Reset the bought tokens to 0 as all tokens will be refunded
        } else if (_saleToRefund == 2) {
            require(saleTwo.isRefundActive, "Refund not active");
            require(boughtTokensSaleTwo[msg.sender] > 0, "No ethers to refund");
            refundAmount = boughtTokensSaleTwo[msg.sender] / saleTwo.price;
            boughtTokensSaleTwo[msg.sender] = 0;
        } else if (_saleToRefund == 3) {
            require(saleThree.isRefundActive, "Refund not active");
            require(
                boughtTokensSaleThree[msg.sender] > 0,
                "No ethers to refund"
            );
            refundAmount = boughtTokensSaleThree[msg.sender] / saleThree.price;
            boughtTokensSaleThree[msg.sender] = 0;
        }
        emit RefundClaimed(msg.sender, refundAmount);
        payable(msg.sender).transfer(refundAmount);
    }

    /************************************ Owner functions ************************************/

    /**
     * @dev Manages the whitelist status of multiple addresses.
     * @param _addresses An array of addresses to manage the whitelist status for.
     * @param _isWhitelisted An array of boolean values indicating whether each address should be whitelisted or not.
     * @notice Only the contract owner can call this function.
     * @notice The length of `_addresses` and `_isWhitelisted` arrays must be the same.
     */
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

    /**
     * @dev Ends a sale and performs necessary actions based on the current sale stage.
     * Only the contract owner can call this function.
     * Ending a sale either activates the refund mechanism or transfers the received Ether to the owner,
     * depending on whether the minimum tokens sold amount is reached or not.
     * The unsold tokens are then burned.
     */
    function endSale(
        uint256 _saleToEnd
    ) external onlyOwner setSaleStage nonReentrant saleMustExist(_saleToEnd) {
        if (_saleToEnd == 1) {
            require(saleStage > SaleStages.SaleOne, "Sale One not ended yet");
            require(!saleOne.isEnded, "Sale One already ended"); // Ensure the sale has not already ended
            saleOne.isEnded = true;

            if (saleOne.soldTokens < saleOne.minSoldTokens) {
                saleOne.isRefundActive = true; // Activate refund, allowing users to claim their Ether back
                saleOne.soldTokens = 0; // Reset sold tokens to 0 as all tokens will be refunded, every token will be burned
            } else {
                uint256 saleOneReceivedETH = saleOne.soldTokens / saleOne.price; // Calculate the amount of Ether received from the sale
                payable(owner()).transfer(saleOneReceivedETH); // Transfer the received Ether to the owner
            }
        } else if (_saleToEnd == 2) {
            require(saleStage > SaleStages.SaleTwo, "Sale One not ended yet");
            require(!saleTwo.isEnded, "Sale Two already ended");
            saleTwo.isEnded = true;

            if (saleTwo.soldTokens < saleTwo.minSoldTokens) {
                saleTwo.isRefundActive = true;
                saleTwo.soldTokens = 0;
            } else {
                uint256 saleTwoReceivedETH = saleTwo.soldTokens / saleTwo.price;
                payable(owner()).transfer(saleTwoReceivedETH);
            }
        } else if (_saleToEnd == 3) {
            require(
                saleStage > SaleStages.SaleThree,
                "Sale Three not ended yet"
            );
            require(!saleThree.isEnded, "Sale Three already ended");
            saleThree.isEnded = true;

            if (saleThree.soldTokens < saleThree.minSoldTokens) {
                saleThree.isRefundActive = true;
                saleThree.soldTokens = 0;
            } else {
                uint256 saleThreeReceivedETH = saleThree.soldTokens /
                    saleThree.price;
                payable(owner()).transfer(saleThreeReceivedETH);
            }
        }
        burnUnsoldTokens(_saleToEnd);

        emit SaleEnded(_saleToEnd);
    }

    /************************************ Internal functions ************************************/

    /**
     * @dev Burns unsold tokens after the ICO ends.
     * If there are unsold tokens, they are burned by calling the `burn` function of the token contract.
     * Emits a `TokenBurned` event with the number of tokens burned.
     */
    function burnUnsoldTokens(uint256 _saleToBurn) internal {
        // Calculate the number of unsold tokens
        uint256 unsoldTokens = 0;
        if (_saleToBurn == 1) {
            unsoldTokens = saleOne.tokenSupply - saleOne.soldTokens;
        } else if (_saleToBurn == 2) {
            unsoldTokens = saleTwo.tokenSupply - saleTwo.soldTokens;
        } else if (_saleToBurn == 3) {
            unsoldTokens = saleThree.tokenSupply - saleThree.soldTokens;
        }

        // Burn the unsold tokens if there are any
        if (unsoldTokens != 0) {
            emit TokenBurned(unsoldTokens);
            token.burn(unsoldTokens);
        }
    }

    /************************************ Modifiers functions ************************************/

    /**
     * @dev Sets the sale stage based on the current time.
     * The sale stage determines the current phase of the ICO.
     * - BeforeStart: Before the start time of the first sale.
     * - SaleOne: During the first sale period.
     * - BetweenSaleOneAndTwo: After the first sale and before the start of the second sale.
     * - SaleTwo: During the second sale period.
     * - BetweenSaleTwoAndThree: After the second sale and before the start of the third sale.
     * - SaleThree: During the third sale period.
     * - CliffPeriod: After the second sale and within the cliff period.
     * - VestingPeriod: After the cliff period and within the vesting period.
     * - Ended: After the vesting period ends.
     */
    modifier setSaleStage() {
        uint256 currentTime = block.timestamp;
        SaleStages _saleStage = SaleStages.BeforeStart;

        if (currentTime < saleOne.startTime) {
            _saleStage = SaleStages.BeforeStart;
        } else if (currentTime < saleOne.endTime) {
            _saleStage = SaleStages.SaleOne;
        } else if (currentTime < saleTwo.startTime) {
            _saleStage = SaleStages.BetweenSaleOneAndTwo;
        } else if (currentTime < saleTwo.endTime) {
            _saleStage = SaleStages.SaleTwo;
        } else if (currentTime < saleThree.startTime) {
            _saleStage = SaleStages.BetweenSaleTwoAndThree;
        } else if (currentTime < saleThree.endTime) {
            _saleStage = SaleStages.SaleThree;
        } else if (currentTime < saleThree.endTime + cliffPeriod) {
            _saleStage = SaleStages.CliffPeriod;
        } else if (
            currentTime < saleThree.endTime + cliffPeriod + vestingPeriod
        ) {
            _saleStage = SaleStages.VestingPeriod;
        } else {
            _saleStage = SaleStages.Ended;
        }

        if (_saleStage != saleStage) {
            saleStage = _saleStage;
            emit SaleStageChanged(saleStage);
        }

        _;
    }

    modifier onlyWhiteListed() {
        require(whitelist[msg.sender], "Not whitelisted");
        _;
    }

    modifier saleMustExist(uint256 _saleNumber) {
        require(
            _saleNumber == 1 || _saleNumber == 2 || _saleNumber == 3,
            "Invalid sale number"
        );
        _;
    }
}
