//---------------------------------------------------
// Copyright (c) 2020-2021 Union Protocol Foundation
// SPDX-License-Identifier: GPL-2.0-or-later
//---------------------------------------------------


pragma solidity >=0.6.2 <0.8.0;

import "../../openzeppelin-contracts-upgradeable/contracts/token/ERC721/IERC721EnumerableUpgradeable.sol";

interface IUUNNRegistry is IERC721EnumerableUpgradeable{
    function mint(uint256 tokenId, address protectionContract, address to) external;
    function burn(uint256 tokenId) external;
    function protectionContract(uint256 tokenId) external view returns (address);
}