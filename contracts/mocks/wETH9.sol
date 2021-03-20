// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../interfaces/IwETH9.sol";

// solhint-disable-next-line contract-name-camelcase
contract wETH9 is ERC20, IwETH9 {
    constructor() ERC20("wETH", "wETH") {}

    function deposit() external payable override {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 _amount) external override {
        _burn(msg.sender, _amount);
        payable(msg.sender).transfer(_amount);
    }
}
