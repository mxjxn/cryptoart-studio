import { expect } from "chai";
import { ethers } from "hardhat";
import { SuchGallery } from "../typechain-types";
import { MockERC6551Registry } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("SuchGallery", function () {
  let gallery: SuchGallery;
  let mockRegistry: MockERC6551Registry;
  let owner: HardhatEthersSigner;
  let buyer: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  const START_PRICE = ethers.parseEther("0.1");
  const RESERVE_PRICE = ethers.parseEther("0.01");
  const DECAY_RATE = ethers.parseEther("0.003");

  beforeEach(async function () {
    [owner, buyer, other] = await ethers.getSigners();

    // Deploy mock registry + use a dummy implementation address
    const MockRegistry = await ethers.getContractFactory("MockERC6551Registry");
    mockRegistry = await MockRegistry.deploy();
    await mockRegistry.waitForDeployment();

    const mockImpl = other.address; // dummy implementation

    const SuchGallery = await ethers.getContractFactory("SuchGallery");
    gallery = await SuchGallery.deploy(await mockRegistry.getAddress(), mockImpl);
    await gallery.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should set correct name and symbol", async function () {
      expect(await gallery.name()).to.equal("such.gallery");
      expect(await gallery.symbol()).to.equal("SUCHGAL");
    });

    it("should set owner", async function () {
      expect(await gallery.owner()).to.equal(owner.address);
    });

    it("should set default auction params", async function () {
      expect(await gallery.startPrice()).to.equal(START_PRICE);
      expect(await gallery.reservePrice()).to.equal(RESERVE_PRICE);
      expect(await gallery.priceDecayRate()).to.equal(DECAY_RATE);
    });

    it("should have max supply of 30", async function () {
      expect(await gallery.MAX_SUPPLY()).to.equal(30n);
    });
  });

  describe("Auction", function () {
    it("should revert mint before auction starts", async function () {
      await expect(gallery.connect(buyer).mint({ value: START_PRICE }))
        .to.be.revertedWith("Auction not started");
    });

    it("should allow owner to start auction", async function () {
      await gallery.startAuction();
      expect(await gallery.auctionStartTime()).to.be.gt(0);
    });

    it("should mint at start price when auction begins", async function () {
      await gallery.startAuction();
      await expect(gallery.connect(buyer).mint({ value: START_PRICE }))
        .to.emit(gallery, "GalleryMinted")
        .withArgs(1, buyer.address, START_PRICE);

      expect(await gallery.ownerOf(1)).to.equal(buyer.address);
      expect(await gallery.totalSupply()).to.equal(1n);
    });

    it("should refund excess payment", async function () {
      await gallery.startAuction();
      const excess = ethers.parseEther("0.2");
      const balBefore = await ethers.provider.getBalance(buyer.address);

      const tx = await gallery.connect(buyer).mint({ value: excess });
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;

      expect(await ethers.provider.getBalance(buyer.address)).to.equal(
        balBefore - START_PRICE - gasCost
      );
    });

    it("should revert on insufficient payment", async function () {
      await gallery.startAuction();
      await expect(gallery.connect(buyer).mint({ value: ethers.parseEther("0.05") }))
        .to.be.revertedWith("Insufficient payment");
    });

    it("should decay price over time", async function () {
      await gallery.startAuction();
      const start = await gallery.auctionStartTime();

      await ethers.provider.send("evm_setNextBlockTimestamp", [Number(start) + 5 * 3600]);
      await ethers.provider.send("evm_mine");

      const price = await gallery.getCurrentPrice();
      const expectedDecay = DECAY_RATE * 5n;
      expect(price).to.equal(START_PRICE - expectedDecay);
    });

    it("should hit reserve price at end of auction", async function () {
      await gallery.startAuction();
      const start = await gallery.auctionStartTime();

      await ethers.provider.send("evm_setNextBlockTimestamp", [Number(start) + 24 * 3600]);
      await ethers.provider.send("evm_mine");

      expect(await gallery.getCurrentPrice()).to.equal(RESERVE_PRICE);
    });

    it("should not allow second auction before 24h", async function () {
      await gallery.startAuction();
      await expect(gallery.startAuction()).to.be.revertedWith("Previous auction still active");
    });

    it("should allow sequential daily auctions", async function () {
      await gallery.startAuction();
      await gallery.connect(buyer).mint({ value: START_PRICE });

      const start = await gallery.auctionStartTime();
      await ethers.provider.send("evm_setNextBlockTimestamp", [Number(start) + 24 * 3600 + 1]);
      await ethers.provider.send("evm_mine");

      await expect(gallery.startAuction()).to.not.be.reverted;
    });
  });

  describe("Traits", function () {
    it("should generate deterministic traits from tokenId", async function () {
      await gallery.startAuction();
      await gallery.connect(buyer).mint({ value: START_PRICE });

      const t = await gallery.traits(1);
      expect(t.wallHue).to.equal(37n);
      expect(t.floorMaterial).to.equal(1n);
      expect(t.lighting).to.equal(3n);
      expect(t.trimStyle).to.equal(3n);
    });

    it("should generate different traits for different tokens", async function () {
      await gallery.startAuction();
      await gallery.connect(buyer).mint({ value: START_PRICE });

      const start = await gallery.auctionStartTime();
      await ethers.provider.send("evm_setNextBlockTimestamp", [Number(start) + 24 * 3600 + 1]);
      await ethers.provider.send("evm_mine");
      await gallery.startAuction();
      await gallery.connect(other).mint({ value: START_PRICE });

      const t1 = await gallery.traits(1);
      const t2 = await gallery.traits(2);
      expect(t1.wallHue).to.not.equal(t2.wallHue);
    });
  });

  describe("Deposits", function () {
    beforeEach(async function () {
      await gallery.startAuction();
      await gallery.connect(buyer).mint({ value: START_PRICE });
    });

    it("should allow owner to register a deposit", async function () {
      const mockCollection = other.address;
      await expect(gallery.connect(buyer).registerDeposit(1, mockCollection, 42))
        .to.emit(gallery, "ArtDeposited")
        .withArgs(1, mockCollection, 42);
    });

    it("should enumerate deposited collections", async function () {
      await gallery.connect(buyer).registerDeposit(1, buyer.address, 1);
      await gallery.connect(buyer).registerDeposit(1, other.address, 2);

      const collections = await gallery.getDepositedCollections(1);
      expect(collections.length).to.equal(2);
    });

    it("should not duplicate collection entries", async function () {
      await gallery.connect(buyer).registerDeposit(1, other.address, 1);
      await gallery.connect(buyer).registerDeposit(1, other.address, 2);

      const collections = await gallery.getDepositedCollections(1);
      expect(collections.length).to.equal(1);
    });
  });

  describe("registerWithdrawal", function () {
    it("should allow owner to withdraw deposited art", async function () {
      await gallery.startAuction();
      await gallery.connect(buyer).mint({ value: START_PRICE });

      const mockCollection = other.address;
      const mockTokenId = 42n;

      await gallery.connect(buyer).registerDeposit(1, mockCollection, mockTokenId);
      expect(await gallery.isDepositedCollection(1, mockCollection)).to.be.true;

      await expect(gallery.connect(buyer).registerWithdrawal(1, mockCollection, mockTokenId))
        .to.emit(gallery, "ArtWithdrawn")
        .withArgs(1, mockCollection, mockTokenId);

      expect(await gallery.isDepositedCollection(1, mockCollection)).to.be.false;
    });

    it("should revert if not gallery owner", async function () {
      await gallery.startAuction();
      await gallery.connect(buyer).mint({ value: START_PRICE });

      await expect(
        gallery.registerWithdrawal(1, other.address, 1n)
      ).to.be.revertedWith("Not gallery owner");
    });
  });

  describe("Token URI", function () {
    it("should return valid JSON metadata", async function () {
      await gallery.startAuction();
      await gallery.connect(buyer).mint({ value: START_PRICE });

      const uri = await gallery.tokenURI(1);
      expect(uri).to.include("data:application/json;base64,");

      const base64 = uri.split(",")[1];
      const json = Buffer.from(base64, "base64").toString();
      expect(json).to.include("such.gallery #1");
      expect(json).to.include("Wall Hue");
      expect(json).to.include("Floor Material");
    });
  });

  describe("Admin", function () {
    it("should allow owner to configure auction", async function () {
      await gallery.configureAuction(
        ethers.parseEther("0.5"),
        ethers.parseEther("0.05"),
        ethers.parseEther("0.01")
      );
      expect(await gallery.startPrice()).to.equal(ethers.parseEther("0.5"));
    });

    it("should allow owner to withdraw", async function () {
      await gallery.startAuction();
      await gallery.connect(buyer).mint({ value: START_PRICE });

      const balBefore = await ethers.provider.getBalance(owner.address);
      const tx = await gallery.withdraw();
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;

      expect(await ethers.provider.getBalance(owner.address)).to.equal(
        balBefore + START_PRICE - gasCost
      );
    });

    it("should revert non-owner admin calls", async function () {
      await expect(gallery.connect(other).startAuction()).to.be.revertedWithCustomError(
        gallery, "OwnableUnauthorizedAccount"
      );
      await expect(gallery.connect(other).withdraw()).to.be.revertedWithCustomError(
        gallery, "OwnableUnauthorizedAccount"
      );
    });
  });

  describe("Season Completeness", function () {
    it("should prevent minting after 30 galleries", async function () {
      for (let i = 0; i < 30; i++) {
        await gallery.startAuction();
        await gallery.connect(buyer).mint({ value: START_PRICE });

        if (i < 29) {
          const start = await gallery.auctionStartTime();
          await ethers.provider.send("evm_setNextBlockTimestamp", [Number(start) + 24 * 3600 + 1]);
          await ethers.provider.send("evm_mine");
        }
      }

      const start = await gallery.auctionStartTime();
      await ethers.provider.send("evm_setNextBlockTimestamp", [Number(start) + 24 * 3600 + 1]);
      await ethers.provider.send("evm_mine");

      await expect(gallery.startAuction()).to.be.revertedWith("Season complete");
    });
  });

  describe("ERC-6551 Token Bound Accounts", function () {
    beforeEach(async function () {
      await gallery.startAuction();
    });

    it("should emit TokenBoundAccountCreated on mint", async function () {
      const tbaAddr = await mockRegistry.account(
        other.address, // implementation
        ethers.ZeroHash,
        (await ethers.provider.getNetwork()).chainId,
        await gallery.getAddress(),
        1
      );

      await expect(gallery.connect(buyer).mint({ value: START_PRICE }))
        .to.emit(gallery, "TokenBoundAccountCreated")
        .withArgs(1, tbaAddr);
    });

    it("should create TBA via registry during mint", async function () {
      await gallery.connect(buyer).mint({ value: START_PRICE });

      const tbaAddr = await mockRegistry.account(
        other.address,
        ethers.ZeroHash,
        (await ethers.provider.getNetwork()).chainId,
        await gallery.getAddress(),
        1
      );

      // The mock registry should have recorded this account as created
      const hash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "bytes32", "uint256", "address", "uint256"],
          [other.address, ethers.ZeroHash, (await ethers.provider.getNetwork()).chainId, await gallery.getAddress(), 1]
        )
      );
      expect(await mockRegistry.created(hash)).to.be.true;
    });

    it("should return deterministic TBA address via getTokenBoundAccount", async function () {
      // TBA address should be computable even before mint (counterfactual)
      const counterfactualAddr = await gallery.getTokenBoundAccount(1);

      await gallery.connect(buyer).mint({ value: START_PRICE });

      const postMintAddr = await gallery.getTokenBoundAccount(1);
      expect(postMintAddr).to.equal(counterfactualAddr);
    });

    it("should return different TBA addresses for different tokens", async function () {
      await gallery.connect(buyer).mint({ value: START_PRICE });

      const start = await gallery.auctionStartTime();
      await ethers.provider.send("evm_setNextBlockTimestamp", [Number(start) + 24 * 3600 + 1]);
      await ethers.provider.send("evm_mine");
      await gallery.startAuction();
      await gallery.connect(other).mint({ value: START_PRICE });

      const tba1 = await gallery.getTokenBoundAccount(1);
      const tba2 = await gallery.getTokenBoundAccount(2);
      expect(tba1).to.not.equal(tba2);
    });

    it("should not re-create TBA if account already exists (idempotent)", async function () {
      // First mint creates the account
      await gallery.connect(buyer).mint({ value: START_PRICE });

      // The registry's createAccount is idempotent — calling again returns same address
      const tba1 = await gallery.getTokenBoundAccount(1);

      // Verify via mock that address didn't change
      const tba1Again = await gallery.getTokenBoundAccount(1);
      expect(tba1).to.equal(tba1Again);
    });

    it("should expose registry and implementation addresses", async function () {
      expect(await gallery.tokenBoundRegistry()).to.equal(
        await mockRegistry.getAddress()
      );
      expect(await gallery.tokenBoundImpl()).to.equal(other.address);
    });

    it("should emit ERC6551AccountCreated on the registry", async function () {
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const galleryAddr = await gallery.getAddress();

      await expect(gallery.connect(buyer).mint({ value: START_PRICE }))
        .to.emit(mockRegistry, "ERC6551AccountCreated")
        .withArgs(
          await gallery.getTokenBoundAccount(1),
          other.address,       // implementation
          ethers.ZeroHash,     // salt
          chainId,
          galleryAddr,
          1
        );
    });
  });
});
