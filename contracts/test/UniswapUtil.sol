
pragma solidity >=0.6.6;

import "../../uniswap-v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";
import "../../openzeppelin-contracts-upgradeable/contracts/token/ERC20/IERC20Upgradeable.sol";
import "../../openzeppelin-contracts-upgradeable/contracts/token/ERC20/ERC20Upgradeable.sol";
import "../../openzeppelin-contracts-upgradeable/contracts/token/ERC20/SafeERC20Upgradeable.sol";


contract UniswapUtil{

    using SafeERC20Upgradeable for IERC20Upgradeable;

    IUniswapV2Router01 public router;

    constructor(address _router) public {
        router=IUniswapV2Router01(_router);
    }

    function swapTokens(
        address fromToken,
        uint256 fromAmount,
        address toToken,
        uint256 deadline
    ) public returns (uint256) {
        address[] memory token_address = new address[](2);
        token_address[0] = fromToken;
        token_address[1] = toToken;
        IERC20Upgradeable(fromToken).safeIncreaseAllowance(address(router), fromAmount);
        uint[] memory out = router.swapExactTokensForTokens(
            fromAmount,
            uint256(0),
            token_address,
            address(this),
            deadline
        );
        return out[1];
    }

     function buyExactTokenWithEth(address daiAddress, address to) public payable returns(uint256) {
        uint deadline = now + 15; 
        uint[] memory out =  router.swapExactETHForTokens{value: msg.value}(0, getPathForETHToToken(daiAddress), to, deadline);
        // no need to refund ETH
        return out[1];
    }

    function getPathForETHToToken(address cryptoToken) private view returns (address[] memory) {
        address[] memory path = new address[](2);
        path[0] = IUniswapV2Router01(router).WETH();
        path[1] = cryptoToken;
        return path;
    }

    //  // returns sorted token addresses, used to handle return values from pairs sorted in this order
    // function _sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
    //     require(tokenA != tokenB, 'UniswapV2Library: IDENTICAL_ADDRESSES');
    //     (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    //     require(token0 != address(0), 'UniswapV2Library: ZERO_ADDRESS');
    // }

    // // calculates the CREATE2 address for a pair without making any external calls
    // function _pairFor(address factory, address tokenA, address tokenB) internal pure returns (address pair) {
    //     (address token0, address token1) = _sortTokens(tokenA, tokenB);
    //     pair = address(uint(keccak256(abi.encodePacked(
    //             hex'ff',
    //             factory,
    //             keccak256(abi.encodePacked(token0, token1)),
    //             hex'96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f' // init code hash
    //         ))));
    // }
}
