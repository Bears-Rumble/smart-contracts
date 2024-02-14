//License: None
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract PGLABTOKEN is ERC20 {
    constructor() ERC20("PGLABTOKEN", "PGLT") {}
}