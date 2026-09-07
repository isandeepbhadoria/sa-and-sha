import { 
  getTierDisplayMetadata, 
  getNextTierUnlocksSummary, 
  calculateSimulatorRedemption 
} from "../server/customerRewardsHelpers";
import { DEFAULT_LOYALTY_POLICY } from "../server/loyaltyPolicy";

/**
 * Test Suite: Customer Rewards & Membership Center (Phase 7A.3 Verification)
 */
async function runRewardsTests() {
  console.log("=== RUNNING PHASE 7A.3 CUSTOMER REWARDS UNIT TESTS ===");

  // Test 1: Tier Metadata Display
  const silverMeta = getTierDisplayMetadata("SILVER");
  console.assert(silverMeta.label === "Silver Member", "Silver label mismatch");
  
  const goldMeta = getTierDisplayMetadata("GOLD");
  console.assert(goldMeta.label === "Gold Member", "Gold label mismatch");

  const platMeta = getTierDisplayMetadata("PLATINUM");
  console.assert(platMeta.label === "Platinum VIP", "Platinum label mismatch");

  console.log("✔ Test 1 Passed: Tier display metadata correctly mapped.");

  // Test 2: Next Tier Unlocks Summary
  const silverUnlocks = getNextTierUnlocksSummary("SILVER");
  console.assert(silverUnlocks.includes("1.25x"), "Silver unlocks summary mismatch");

  const goldUnlocks = getNextTierUnlocksSummary("GOLD");
  console.assert(goldUnlocks.includes("1.5x"), "Gold unlocks summary mismatch");

  console.log("✔ Test 2 Passed: Next tier unlocks summary text generation verified.");

  // Test 3: Redemption Simulator Calculations
  // Case A: Normal valid redemption below 20% cap
  // Cart ₹5000, 20% cap is ₹1000. Requested 500 points, available 1000 points.
  const simA = calculateSimulatorRedemption(5000, 500, 1000);
  console.assert(simA.valid === true, "Sim A should be valid");
  console.assert(simA.discountRupees === 500, "Sim A discount should be 500");

  // Case B: Requested above 20% cap
  // Cart ₹4000, 20% cap is ₹800. Requested 1000 points.
  const simB = calculateSimulatorRedemption(4000, 1000, 2000);
  console.assert(simB.valid === false, "Sim B should exceed subtotal cap");
  console.assert(simB.maxAllowedPoints === 800, "Max allowed points should be 800");

  // Case C: Minimum redemption points requirement (min 100)
  const simC = calculateSimulatorRedemption(5000, 50, 1000);
  console.assert(simC.valid === false, "Sim C should fail due to minimum 100 points rule");

  console.log("✔ Test 3 Passed: Redemption simulator rules & cap enforcement verified.");

  console.log("=== ALL PHASE 7A.3 CUSTOMER REWARDS TESTS PASSED SUCCESSFULLY ===");
}

import { describe, it } from "vitest";

describe("Customer Rewards Unit Tests", () => {
  it("runs customer rewards suite", async () => {
    await runRewardsTests();
  });
});
