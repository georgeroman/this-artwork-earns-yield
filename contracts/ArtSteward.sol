// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "./interfaces/IwETH9.sol";
import "./interfaces/IywETHv2.sol";

contract ArtSteward {
    using Address for address payable;
    using Math for uint256;

    address public owner;
    address public artist;
    IERC721 public art;

    uint256 public purchasePrice;
    uint256 public sellPrice;

    mapping(address => uint256) public funds;

    IwETH9 private wETH9 = IwETH9(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IywETHv2 private ywETHv2 = IywETHv2(0xa9fE4601811213c340e850ea305481afF02f5b28);

    constructor(address _art, address _artist) {
        owner = address(this);
        art = IERC721(_art);
        artist = _artist;
    }

    receive() external payable {}

    function buy(uint256 _newSellPrice) external payable {
        uint256 deposit = _getDeposit(purchasePrice, sellPrice);
        uint256 newDeposit = _getDeposit(sellPrice, _newSellPrice);

        require(msg.value == sellPrice + newDeposit, "Incorrect amount");

        collectYield();

        funds[owner] += sellPrice;
        if (deposit > 0) {
            funds[owner] += _withdrawFromVault((deposit * 1e18) / ywETHv2.pricePerShare());
        }

        if (newDeposit > 0) {
            _depositToVault(newDeposit);
        }

        owner = msg.sender;
        purchasePrice = sellPrice;
        sellPrice = _newSellPrice;
    }

    function setPrice(uint256 _newSellPrice) external payable {
        if (_newSellPrice > sellPrice) {
            _depositToVault(_newSellPrice - sellPrice);
        } else if (_newSellPrice < sellPrice) {
            uint256 totalShares = ywETHv2.balanceOf(address(this));
            uint256 surplusShares = ((sellPrice - _newSellPrice) * 1e18) / ywETHv2.pricePerShare();
            _withdrawFromVault(totalShares.min(surplusShares));
        }
        sellPrice = _newSellPrice;
    }

    function collectYield() public {
        require(
            msg.sender == address(this) || msg.sender == owner || msg.sender == artist,
            "Unauthorized"
        );

        uint256 deposit = _getDeposit(purchasePrice, sellPrice);
        uint256 totalShares = ywETHv2.balanceOf(address(this));
        uint256 depositShares = (deposit * 1e18) / ywETHv2.pricePerShare();
        if (totalShares > depositShares) {
            uint256 yieldShares = totalShares - depositShares;
            funds[owner] += _withdrawFromVault(yieldShares / 2);
            funds[artist] += _withdrawFromVault(yieldShares - yieldShares / 2);
        }
    }

    function pullFunds() public {
        uint256 fundsAvailable = funds[msg.sender];
        funds[msg.sender] = 0;

        if (fundsAvailable > 0) {
            payable(msg.sender).sendValue(fundsAvailable);
        }
    }

    function collectYieldAndPullFunds() external {
        collectYield();
        pullFunds();
    }

    function _getDeposit(uint256 _purchasePrice, uint256 _sellPrice)
        internal
        pure
        returns (uint256)
    {
        return _sellPrice > _purchasePrice ? _sellPrice - _purchasePrice : 0;
    }

    function _depositToVault(uint256 _amount) internal returns (uint256) {
        wETH9.deposit{value: _amount}();
        wETH9.approve(address(ywETHv2), _amount);
        return ywETHv2.deposit(_amount);
    }

    function _withdrawFromVault(uint256 _shares) internal returns (uint256) {
        uint256 redeemed = ywETHv2.withdraw(_shares);
        wETH9.withdraw(redeemed);
        return redeemed;
    }
}
