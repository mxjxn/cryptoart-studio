#!/bin/bash

# Install Foundry dependencies for Party Gallery

echo "Installing Foundry dependencies..."

# Create lib directory if it doesn't exist
mkdir -p lib

# Install forge-std
forge install foundry-rs/forge-std --no-commit

# Install OpenZeppelin contracts
forge install OpenZeppelin/openzeppelin-contracts --no-commit

# Install ERC-6551 reference implementation
forge install erc6551/reference --no-commit

# Install Party Protocol (for reference/testing)
forge install PartyDAO/party-protocol --no-commit

echo "Dependencies installed successfully!"
echo ""
echo "Installed:"
echo "  - forge-std (testing utilities)"
echo "  - openzeppelin-contracts (ERC standards)"
echo "  - erc6551/reference (Token Bound Accounts)"
echo "  - party-protocol (DAO governance)"
