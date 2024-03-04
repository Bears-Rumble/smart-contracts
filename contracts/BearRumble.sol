// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "./baseContracts/ERC20Burnable.sol";

contract BearRumble is ERC20Burnable {
    constructor() ERC20("BearRumble", "BR") {
        _mint(msg.sender, 1_000_000_000 * 10 ** decimals());
    }
}