// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "./TAEY.sol";
import "./interfaces/IwETH9.sol";
import "./interfaces/IyvwETHv2.sol";

contract ArtSteward is ReentrancyGuard {
    using Math for uint256;

    IERC721 public art;
    address public owner;
    address public artist;

    uint256 public purchasePrice;
    uint256 public sellPrice;

    mapping(address => uint256) public funds;

    IwETH9 private wETH9 = IwETH9(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IyvwETHv2 private yvwETHv2 = IyvwETHv2(0xa9fE4601811213c340e850ea305481afF02f5b28);

    constructor(address _artist) {
        art = new TAEY();
        owner = _artist;
        artist = _artist;
    }

    receive() external payable {
        // Needed for unwrapping wETH
    }

    function buy(uint256 _newSellPrice) external payable nonReentrant {
        // The deposit represents the difference between the purchase and sell prices
        uint256 newDeposit = _getDeposit(sellPrice, _newSellPrice);

        // Make sure the buyer has the needed funds
        require(msg.value == sellPrice + newDeposit, "Incorrect amount");

        // Collect any yield for the current owner and the artist
        _collectYield();

        // After collecting the yield, the remaining shares denote the owner's deposit
        uint256 previousDepositShares = yvwETHv2.balanceOf(address(this));
        uint256 redeemed = _withdrawFromVault(previousDepositShares);

        // Pay the current owner the sell price and deposit
        _sendFunds(owner, sellPrice + redeemed);

        // Deposit the new owner's deposit
        _depositToVault(newDeposit);

        // Adjust ownership parameters
        owner = msg.sender;
        purchasePrice = sellPrice;
        sellPrice = _newSellPrice;
    }

    function setPrice(uint256 _newSellPrice) external payable nonReentrant {
        if (_newSellPrice > sellPrice) {
            // If the new sell price is higher than the old one, more deposit is needed
            uint256 amountToDeposit = _newSellPrice - sellPrice;
            require(msg.value == amountToDeposit, "Incorrect amount");
            _depositToVault(amountToDeposit);
        } else if (_newSellPrice < sellPrice) {
            // Else, we need to return part of the deposit
            uint256 depositShares = _getCurrentDepositShares();
            uint256 surplusShares = ((sellPrice - _newSellPrice) * 1e18) / yvwETHv2.pricePerShare();
            uint256 redeemed = _withdrawFromVault(depositShares.min(surplusShares));
            _sendFunds(owner, redeemed);
        }
        sellPrice = _newSellPrice;
    }

    function collectYield() public nonReentrant {
        require(msg.sender == owner || msg.sender == artist, "Unauthorized");
        _collectYield();
    }

    function pullFunds() public nonReentrant {
        // Pull any escrowed funds
        uint256 fundsAvailable = funds[msg.sender];
        funds[msg.sender] = 0;
        if (fundsAvailable > 0) {
            _sendFunds(msg.sender, fundsAvailable);
        }
    }

    function _collectYield() internal {
        uint256 totalShares = yvwETHv2.balanceOf(address(this));
        uint256 depositShares = _getCurrentDepositShares();
        if (totalShares > depositShares) {
            // Any shares not belonging to the deposit correspond to yield
            uint256 yieldShares = totalShares - depositShares;
            uint256 yield = _withdrawFromVault(yieldShares);
            // Split the yield between the owner and the artist
            _sendFunds(owner, yield / 2);
            _sendFunds(artist, yield - yield / 2);
        }
    }

    function _sendFunds(address _recipient, uint256 _amount) internal {
        // Try sending the funds to the recipient, or else put them in an escrow
        // solhint-disable-next-line avoid-low-level-calls, avoid-call-value
        (bool success, ) = _recipient.call{value: _amount}("");
        if (!success) {
            funds[_recipient] += _amount;
        }
    }

    function _getDeposit(uint256 _purchasePrice, uint256 _sellPrice)
        internal
        pure
        returns (uint256)
    {
        return _sellPrice > _purchasePrice ? _sellPrice - _purchasePrice : 0;
    }

    function _getCurrentDepositShares() internal view returns (uint256) {
        uint256 deposit = _getDeposit(purchasePrice, sellPrice);
        uint256 depositShares = (deposit * 1e18) / yvwETHv2.pricePerShare();
        uint256 totalShares = yvwETHv2.balanceOf(address(this));
        // Handle the case of a negative yield when we would lose money on the deposit
        return totalShares.min(depositShares);
    }

    function _depositToVault(uint256 _amount) internal returns (uint256) {
        wETH9.deposit{value: _amount}();
        wETH9.approve(address(yvwETHv2), _amount);
        return yvwETHv2.deposit(_amount);
    }

    function _withdrawFromVault(uint256 _shares) internal returns (uint256) {
        uint256 redeemed = yvwETHv2.withdraw(_shares);
        wETH9.withdraw(redeemed);
        return redeemed;
    }

    // Only for testing purposes, remove on deployment!

    function setWETH9(address _wETH9) external {
        wETH9 = IwETH9(_wETH9);
    }

    function setYvwETHv2(address _yvwETHv2) external {
        yvwETHv2 = IyvwETHv2(_yvwETHv2);
    }
}
