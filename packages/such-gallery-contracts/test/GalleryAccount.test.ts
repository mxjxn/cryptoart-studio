import { expect } from "chai";
import { ethers } from "hardhat";
import { SuchGallery, MockERC721Art, MockERC1155Art, MockGalleryAccount } from "../typechain-types";
import { MockERC6551Registry } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("GalleryAccount — Auto-Registration", function () {
  let gallery: SuchGallery;
  let mockRegistry: MockERC6551Registry;
  let mockArt721: MockERC721Art;
  let mockArt1155: MockERC1155Art;
  let owner: HardhatEthersSigner;
  let buyer: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  const START_PRICE = ethers.parseEther("0.1");
  const RESERVE_PRICE = ethers.parseEther("0.01");

  beforeEach(async function () {
    [owner, buyer, other] = await ethers.getSigners();

    const MockRegistry = await ethers.getContractFactory("MockERC6551Registry");
    mockRegistry = await MockRegistry.deploy();
    await mockRegistry.waitForDeployment();

    // Deploy mock art contracts
    const Art721 = await ethers.getContractFactory("MockERC721Art");
    mockArt721 = await Art721.deploy();
    await mockArt721.waitForDeployment();

    const Art1155 = await ethers.getContractFactory("MockERC1155Art");
    mockArt1155 = await Art1155.deploy();
    await mockArt1155.waitForDeployment();

    const mockImpl = other.address; // dummy implementation for registry

    const SuchGallery = await ethers.getContractFactory("SuchGallery");
    gallery = await SuchGallery.deploy(await mockRegistry.getAddress(), mockImpl);
    await gallery.waitForDeployment();
  });

  /**
   * Helper: mint a gallery, deploy a MockGalleryAccount wired to it,
   * then update the registry mock so getTokenBoundAccount returns the mock TBA.
   * This simulates what the real ERC-6551 registry does with EIP-1167 proxies.
   *
   * Unfortunately we can't easily override getTokenBoundAccount in SuchGallery
   * since it reads from the immutable registry. Instead we test autoRegisterDeposit
   * directly by calling it from the mock TBA address.
   */
  async function mintGalleryAndGetMockTBA(galleryTokenId: number) {
    // Mint a gallery
    await gallery.startAuction();
    await gallery.connect(buyer).mint({ value: START_PRICE });

    // Deploy a MockGalleryAccount that thinks it belongs to this gallery NFT
    const MockTBA = await ethers.getContractFactory("MockGalleryAccount");
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const mockTBA = await MockTBA.deploy(
      chainId,
      await gallery.getAddress(),
      galleryTokenId
    );
    await mockTBA.waitForDeployment();

    return mockTBA;
  }

  describe("autoRegisterDeposit (ERC-721)", function () {
    it("should reject autoRegisterDeposit from non-TBA address", async function () {
      const galleryTokenId = 1;
      await mintGalleryAndGetMockTBA(galleryTokenId);

      await expect(
        gallery.autoRegisterDeposit(galleryTokenId, await mockArt721.getAddress(), 1)
      ).to.be.revertedWith("Not gallery TBA");
    });
  });

  describe("autoRegisterDeposit — unit test", function () {
    it("should register deposit when called by the registered TBA", async function () {
      // Mint gallery
      await gallery.startAuction();
      await gallery.connect(buyer).mint({ value: START_PRICE });

      const galleryTokenId = 1;
      const artAddr = await mockArt721.getAddress();

      // Get the registered TBA address from the gallery
      const registeredTBA = await gallery.getTokenBoundAccount(galleryTokenId);

      // Impersonate the registered TBA
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [registeredTBA],
      });
      // Fund it
      await owner.sendTransaction({
        to: registeredTBA,
        value: ethers.parseEther("1"),
      });
      const tbaSigner = await ethers.getSigner(registeredTBA);

      // Call autoRegisterDeposit as the TBA
      await expect(
        gallery.connect(tbaSigner).autoRegisterDeposit(galleryTokenId, artAddr, 42)
      )
        .to.emit(gallery, "ArtDeposited")
        .withArgs(galleryTokenId, artAddr, 42);

      // Verify the collection was indexed
      const collections = await gallery.getDepositedCollections(galleryTokenId);
      expect(collections.length).to.equal(1);
      expect(collections[0]).to.equal(artAddr);

      await network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [registeredTBA],
      });
    });

    it("should not duplicate collection in index on second deposit", async function () {
      await gallery.startAuction();
      await gallery.connect(buyer).mint({ value: START_PRICE });

      const galleryTokenId = 1;
      const artAddr = await mockArt721.getAddress();
      const registeredTBA = await gallery.getTokenBoundAccount(galleryTokenId);

      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [registeredTBA],
      });
      await owner.sendTransaction({
        to: registeredTBA,
        value: ethers.parseEther("1"),
      });
      const tbaSigner = await ethers.getSigner(registeredTBA);

      // Deposit two tokens from the same collection
      await gallery.connect(tbaSigner).autoRegisterDeposit(galleryTokenId, artAddr, 1);
      await gallery.connect(tbaSigner).autoRegisterDeposit(galleryTokenId, artAddr, 2);

      // Collection should only appear once
      const collections = await gallery.getDepositedCollections(galleryTokenId);
      expect(collections.length).to.equal(1);

      await network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [registeredTBA],
      });
    });

    it("should reject autoRegisterDeposit from wrong address", async function () {
      await gallery.startAuction();
      await gallery.connect(buyer).mint({ value: START_PRICE });

      await expect(
        gallery.connect(other).autoRegisterDeposit(1, await mockArt721.getAddress(), 1)
      ).to.be.revertedWith("Not gallery TBA");
    });
  });

  describe("GalleryAccount receiver hooks", function () {
    it("should accept ERC-721 via onERC721Received", async function () {
      const mockTBA = await mintGalleryAndGetMockTBA(1);
      const tbaAddress = await mockTBA.getAddress();

      // Mint art to buyer
      await mockArt721.connect(buyer).mint(buyer.address);
      const artTokenId = 1;

      // safeTransferFrom should not revert
      await mockArt721.connect(buyer).approve(tbaAddress, artTokenId);
      await expect(
        mockArt721.connect(buyer)["safeTransferFrom(address,address,uint256)"](
          buyer.address,
          tbaAddress,
          artTokenId
        )
      ).to.not.be.reverted;

      // Verify the TBA now holds the NFT
      expect(await mockArt721.ownerOf(artTokenId)).to.equal(tbaAddress);
    });

    it("should accept ERC-1155 via onERC1155Received", async function () {
      const mockTBA = await mintGalleryAndGetMockTBA(1);
      const tbaAddress = await mockTBA.getAddress();

      // Mint ERC-1155 to buyer
      await mockArt1155.connect(buyer).mint(buyer.address, 5);
      const artTokenId = 1;

      // safeTransferFrom should not revert
      await expect(
        mockArt1155.connect(buyer).safeTransferFrom(
          buyer.address,
          tbaAddress,
          artTokenId,
          3,
          "0x"
        )
      ).to.not.be.reverted;

      // Verify the TBA holds the tokens
      expect(await mockArt1155.balanceOf(tbaAddress, artTokenId)).to.equal(3);
    });

    it("should accept ERC-1155 batch via onERC1155BatchReceived", async function () {
      const mockTBA = await mintGalleryAndGetMockTBA(1);
      const tbaAddress = await mockTBA.getAddress();

      // Mint two ERC-1155 tokens
      const id1 = await mockArt1155.connect(buyer).mint(buyer.address, 10);
      const id2 = await mockArt1155.connect(buyer).mint(buyer.address, 10);

      await expect(
        mockArt1155.connect(buyer).safeBatchTransferFrom(
          buyer.address,
          tbaAddress,
          [1, 2],
          [3, 5],
          "0x"
        )
      ).to.not.be.reverted;

      expect(await mockArt1155.balanceOf(tbaAddress, 1)).to.equal(3);
      expect(await mockArt1155.balanceOf(tbaAddress, 2)).to.equal(5);
    });
  });

  describe("GalleryAccount execute and ownership", function () {
    it("should allow owner to execute calls via TBA", async function () {
      const mockTBA = await mintGalleryAndGetMockTBA(1);

      // Fund the TBA
      await owner.sendTransaction({
        to: await mockTBA.getAddress(),
        value: ethers.parseEther("1"),
      });

      // Owner (buyer) can execute
      const artAddr = await mockArt721.getAddress();
      const calldata = mockArt721.interface.encodeFunctionData("mint", [buyer.address]);

      await expect(
        mockTBA.connect(buyer).execute(artAddr, 0, calldata, 0)
      ).to.not.be.reverted;
    });

    it("should reject execute from non-owner", async function () {
      const mockTBA = await mintGalleryAndGetMockTBA(1);

      await owner.sendTransaction({
        to: await mockTBA.getAddress(),
        value: ethers.parseEther("1"),
      });

      const calldata = "0x";
      await expect(
        mockTBA.connect(other).execute(other.address, 0, calldata, 0)
      ).to.be.revertedWith("Invalid signer");
    });

    it("should reject DELEGATECALL operation", async function () {
      const mockTBA = await mintGalleryAndGetMockTBA(1);

      await expect(
        mockTBA.connect(buyer).execute(other.address, 0, "0x", 1)
      ).to.be.revertedWith("Unsupported operation");
    });
  });

  describe("GalleryAccount supportsInterface", function () {
    it("should support ERC721Receiver, ERC1155Receiver, ERC6551Account, ERC6551Executable", async function () {
      const mockTBA = await mintGalleryAndGetMockTBA(1);

      // IERC165
      expect(await mockTBA.supportsInterface("0x01ffc9a7")).to.be.true;
      // IERC721Receiver
      expect(await mockTBA.supportsInterface("0x150b7a02")).to.be.true;
      // IERC1155Receiver (composite of onERC1155Received + onERC1155BatchReceived)
      expect(await mockTBA.supportsInterface("0x4e2312e0")).to.be.true;
      // IERC6551Account
      expect(await mockTBA.supportsInterface("0x6faff5f1")).to.be.true;
      // IERC6551Executable
      expect(await mockTBA.supportsInterface("0x51945447")).to.be.true;
    });
  });
});
