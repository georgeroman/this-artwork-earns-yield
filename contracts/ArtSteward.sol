// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "./interfaces/IwETH9.sol";
import "./interfaces/IywETHV2.sol";

contract ArtSteward {
    using Address for address payable;
    using Math for uint256;

    struct Bid {
        uint256 id;
        address purchaser;
        uint256 price;
        uint256 eta;
    }

    address public owner;
    address public creator;
    IERC721 public art;

    uint256 public totalDeposited;
    mapping(address => uint256) public deposits;

    uint256 public bidCount;
    mapping(uint256 => Bid) public bids;

    IwETH9 private wETH9 = IwETH9(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IywETHV2 private ywETHV2 = IywETHV2(0xa9fE4601811213c340e850ea305481afF02f5b28);

    event BidCreated(uint256 id, address purchaser, uint256 price, uint256 eta);

    constructor(address _creator, address _art) {
        creator = _creator;
        art = IERC721(_art);
    }

    receive() external payable {}

    function deposit() public payable {
        _deposit(msg.sender, msg.value);
    }

    function _deposit(address _account, uint256 _amount) internal {
        deposits[_account] += _amount;
        totalDeposited += _amount;

        wETH9.deposit{value: _amount}();
        wETH9.approve(address(ywETHV2), _amount);

        ywETHV2.deposit(_amount);
    }

    function withdraw(uint256 _amount) public {
        _withdraw(msg.sender, _amount, false);
    }

    function withdrawAll() public {
        _withdraw(msg.sender, deposits[msg.sender], msg.sender == creator);
    }

    function _withdraw(
        address _account,
        uint256 _amount,
        bool _withdrawYield
    ) internal {
        deposits[_account] -= _amount;
        totalDeposited -= _amount;

        uint256 shares = _amount / ywETHV2.pricePerShare();
        uint256 redeemed = ywETHV2.withdraw(shares);
        uint256 amountToWithdraw = redeemed.min(_amount);

        if (_withdrawYield) {
            uint256 depositShares = totalDeposited / ywETHV2.pricePerShare();
            uint256 totalShares = ywETHV2.balanceOf(address(this));
            amountToWithdraw += ywETHV2.withdraw(totalShares - depositShares);
        }

        wETH9.withdraw(amountToWithdraw);
        payable(_account).sendValue(amountToWithdraw);
    }

    function bid(uint256 _price) public returns (uint256) {
        require(_price > deposits[owner], "Price too low");

        Bid storage newBid = bids[bidCount];
        newBid.id = bidCount;
        newBid.purchaser = msg.sender;
        newBid.price = _price;
        newBid.eta = block.timestamp + 4 hours;
        bidCount++;

        emit BidCreated(newBid.id, newBid.purchaser, newBid.price, newBid.eta);
        return newBid.id;
    }

    function buy(uint256 _bidId) public {
        require(_bidId >= 0 && _bidId < bidCount, "Invalid bid");

        Bid storage existingBid = bids[_bidId];
        require(existingBid.purchaser == msg.sender, "Unauthorized");
        require(existingBid.eta <= block.timestamp, "Eta not met");
        require(existingBid.price > deposits[owner], "Price too low");
        require(existingBid.price <= deposits[existingBid.purchaser], "Insufficient funds");

        deposits[existingBid.purchaser] -= existingBid.price;

        uint256 ownerShare = (existingBid.price * 95) / 100;
        _deposit(owner, ownerShare);

        uint256 creatorShare = existingBid.price - ownerShare;
        _deposit(creator, creatorShare);

        owner = existingBid.purchaser;
    }
}
