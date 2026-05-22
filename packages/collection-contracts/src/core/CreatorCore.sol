// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import {ReentrancyGuard} from "openzeppelin/utils/ReentrancyGuard.sol";
import {Strings} from "openzeppelin/utils/Strings.sol";
import {EnumerableSet} from "openzeppelin/utils/structs/EnumerableSet.sol";

abstract contract CreatorCore is ReentrancyGuard {
    using Strings for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    uint256 internal _tokenCount;

    EnumerableSet.AddressSet internal _extensions;

    mapping(address => string) private _extensionBaseURI;
    mapping(address => string) private _extensionURIPrefix;
    mapping(uint256 => string) internal _tokenURIs;

    struct RoyaltyConfig {
        address payable receiver;
        uint16 bps;
    }

    mapping(address => RoyaltyConfig[]) internal _extensionRoyalty;
    mapping(uint256 => RoyaltyConfig[]) internal _tokenRoyalty;

    event ExtensionRegistered(address indexed extension, address indexed sender);
    event ExtensionUnregistered(address indexed extension, address indexed sender);
    event RoyaltiesUpdated(uint256 indexed tokenId, address payable[] receivers, uint256[] basisPoints);
    event DefaultRoyaltiesUpdated(address payable[] receivers, uint256[] basisPoints);

    function _ROYALTY_INTERFACE_ID() internal pure returns (bytes4) {
        return 0x2a55205a;
    }

    function requireExtension() internal view {
        require(_extensions.contains(msg.sender), "Must be registered extension");
    }

    function getExtensions() external view returns (address[] memory extensions) {
        extensions = new address[](_extensions.length());
        for (uint256 i; i < _extensions.length();) {
            extensions[i] = _extensions.at(i);
            unchecked {
                ++i;
            }
        }
        return extensions;
    }

    function _registerExtension(address extension, string calldata baseURI) internal virtual {
        require(extension != address(this) && extension.code.length > 0, "Invalid extension");
        emit ExtensionRegistered(extension, msg.sender);
        _extensionBaseURI[extension] = baseURI;
        _extensions.add(extension);
    }

    function _unregisterExtension(address extension) internal {
        emit ExtensionUnregistered(extension, msg.sender);
        _extensions.remove(extension);
    }

    function _setBaseTokenURIExtension(string calldata uri) internal {
        _extensionBaseURI[msg.sender] = uri;
    }

    function _setTokenURIPrefixExtension(string calldata prefix) internal {
        _extensionURIPrefix[msg.sender] = prefix;
    }

    function _setTokenURIExtension(uint256 tokenId, string calldata uri) internal {
        require(_tokenExtension(tokenId) == msg.sender, "Invalid token");
        _tokenURIs[tokenId] = uri;
    }

    function _setBaseTokenURI(string calldata uri) internal {
        _extensionBaseURI[address(0)] = uri;
    }

    function _setTokenURIPrefix(string calldata prefix) internal {
        _extensionURIPrefix[address(0)] = prefix;
    }

    function _setTokenURI(uint256 tokenId, string calldata uri) internal {
        require(tokenId > 0 && tokenId <= _tokenCount && _tokenExtension(tokenId) == address(0), "Invalid token");
        _tokenURIs[tokenId] = uri;
    }

    function _tokenURI(uint256 tokenId) internal view returns (string memory) {
        require(tokenId > 0 && tokenId <= _tokenCount, "Invalid token");

        address extension = _tokenExtension(tokenId);

        if (bytes(_tokenURIs[tokenId]).length != 0) {
            if (bytes(_extensionURIPrefix[extension]).length != 0) {
                return string(abi.encodePacked(_extensionURIPrefix[extension], _tokenURIs[tokenId]));
            }
            return _tokenURIs[tokenId];
        }

        return string(abi.encodePacked(_extensionBaseURI[extension], tokenId.toString()));
    }

    function _getRoyalties(uint256 tokenId)
        internal
        view
        returns (address payable[] memory receivers, uint256[] memory bps)
    {
        RoyaltyConfig[] memory royalties = _tokenRoyalty[tokenId];
        if (royalties.length == 0) {
            address extension = _tokenExtension(tokenId);
            if (extension != address(0)) {
                royalties = _extensionRoyalty[extension];
            }
        }
        if (royalties.length == 0) {
            royalties = _extensionRoyalty[address(0)];
        }

        if (royalties.length > 0) {
            receivers = new address payable[](royalties.length);
            bps = new uint256[](royalties.length);
            for (uint256 i; i < royalties.length;) {
                receivers[i] = royalties[i].receiver;
                bps[i] = royalties[i].bps;
                unchecked {
                    ++i;
                }
            }
        }
    }

    function _getRoyaltyInfo(uint256 tokenId, uint256 value) internal view returns (address receiver, uint256 amount) {
        (address payable[] memory receivers, uint256[] memory bps) = _getRoyalties(tokenId);
        require(receivers.length <= 1, "More than 1 royalty receiver");

        if (receivers.length == 0) {
            return (address(this), 0);
        }
        return (receivers[0], bps[0] * value / 10000);
    }

    function _setRoyalties(uint256 tokenId, address payable[] memory receivers, uint256[] memory basisPoints)
        internal
    {
        _checkRoyalties(receivers, basisPoints);
        delete _tokenRoyalty[tokenId];
        _setRoyalties(receivers, basisPoints, _tokenRoyalty[tokenId]);
        emit RoyaltiesUpdated(tokenId, receivers, basisPoints);
    }

    function _setRoyaltiesExtension(
        address extension,
        address payable[] memory receivers,
        uint256[] memory basisPoints
    ) internal {
        _checkRoyalties(receivers, basisPoints);
        delete _extensionRoyalty[extension];
        _setRoyalties(receivers, basisPoints, _extensionRoyalty[extension]);
        if (extension == address(0)) {
            emit DefaultRoyaltiesUpdated(receivers, basisPoints);
        }
    }

    function _checkRoyalties(address payable[] memory receivers, uint256[] memory basisPoints) private pure {
        require(receivers.length == basisPoints.length, "Invalid input");
        uint256 totalBasisPoints;
        for (uint256 i; i < basisPoints.length;) {
            totalBasisPoints += basisPoints[i];
            unchecked {
                ++i;
            }
        }
        require(totalBasisPoints < 10000, "Invalid total royalties");
    }

    function _setRoyalties(
        address payable[] memory receivers,
        uint256[] memory basisPoints,
        RoyaltyConfig[] storage royalties
    ) private {
        for (uint256 i; i < basisPoints.length;) {
            royalties.push(RoyaltyConfig({receiver: receivers[i], bps: uint16(basisPoints[i])}));
            unchecked {
                ++i;
            }
        }
    }

    function _tokenExtension(uint256 tokenId) internal view virtual returns (address);
}
