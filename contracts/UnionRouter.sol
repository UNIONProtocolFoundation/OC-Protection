//---------------------------------------------------
// Copyright (c) 2020-2021 Union Protocol Foundation
// SPDX-License-Identifier: GPL-2.0-or-later
//---------------------------------------------------

pragma solidity >=0.6.12;

import "../openzeppelin-contracts-upgradeable/contracts/access/AccessControlUpgradeable.sol";
import "./interfaces/IUnionRouter.sol";

contract UnionRouter is AccessControlUpgradeable, IUnionRouter{

  mapping (address => address) public poolForCollateralToken;
  mapping (address => address) public sellerContractForCollateralToken;
  address public uunnTokenAddress;
  
  function initialize(address admin) public initializer{
        __AccessControl_init();
        //access control initial setup
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
  }

  /**
  * @dev Throws if called by any account other than the one with the Admin role granted.
  */
  modifier onlyAdmin() {
      require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not the Admin");
      _;
  }

  function addCollateralProtection(address token, address pool, address sellerContract) public onlyAdmin{
    poolForCollateralToken[token] = pool;
    sellerContractForCollateralToken[token] = sellerContract;
  }

  function removeCollateralProtection(address token) public onlyAdmin {
    delete poolForCollateralToken[token];
    delete sellerContractForCollateralToken[token];
  }

  function setUUNNToken(address _address) public onlyAdmin {
    uunnTokenAddress = _address;
  }

  function collateralProtection(address token) public override view returns (address, address){
    return (sellerContractForCollateralToken[token], poolForCollateralToken[token]);
  }

  function uunnToken() public override view returns (address){
    return uunnTokenAddress;
  }

}
