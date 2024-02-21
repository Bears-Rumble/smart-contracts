// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "./baseContracts/ERC20.sol";

contract BearRumble is ERC20 {
    constructor() ERC20("BearRumble", "BR") {}
}