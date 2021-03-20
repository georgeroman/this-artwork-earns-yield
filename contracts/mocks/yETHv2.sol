// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract yETHv2 is ERC20 {
    constructor() ERC20("yETHv2", "yETHv2") {}

    function deposit(uint256 _amount) external payable {
        _mint(msg.sender, _amount);
    }

    function withdraw(uint256 _shares) external payable {}

    function pricePerShare() external view returns (uint256) {
        return 1;
    }
}