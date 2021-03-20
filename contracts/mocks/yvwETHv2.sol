// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../interfaces/IwETH9.sol";
import "../interfaces/IyvwETHv2.sol";

// solhint-disable-next-line contract-name-camelcase
contract yvwETHv2 is ERC20, IyvwETHv2 {
    address public admin;

    uint256 private _pricePerShare;

    IwETH9 private wETH9;

    constructor(address _wETH9) ERC20("yvwETHv2", "yvwETHv2") {
        wETH9 = IwETH9(_wETH9);
        admin = msg.sender;
        _pricePerShare = 1e18;
    }

    function deposit(uint256 _amount) external override returns (uint256) {
        wETH9.transferFrom(msg.sender, address(this), _amount);
        uint256 shares = (_amount * 1e18) / _pricePerShare;
        _mint(msg.sender, shares);
        return shares;
    }

    function withdraw(uint256 _shares) external override returns (uint256) {
        require(balanceOf(msg.sender) >= _shares, "Insufficient funds");
        uint256 amount = (_shares * _pricePerShare) / 1e18;
        _burn(msg.sender, _shares);
        wETH9.transfer(msg.sender, amount);
        return amount;
    }

    function setPricePerShare(uint256 _newPricePerShare) external {
        require(msg.sender == admin, "Unauthorized");
        _pricePerShare = _newPricePerShare;
    }

    function pricePerShare() external view override returns (uint256) {
        return _pricePerShare;
    }
}
