import { createHash } from "node:crypto";

export const SCENARIO = {
  id: "shipping-discount-v1",
  title: "The free-shipping regression",
  description: "A discount takes an order below the free-shipping threshold, but the agent's first fix still ships it for free.",
  requirement: "Export function quoteShipping(subtotalCents, discountCents). Both inputs are non-negative safe integers. Shipping is 0 cents when Math.max(0, subtotalCents - discountCents) is at least 5000 cents; otherwise it is 599 cents. Return the shipping fee as an integer. No dependencies or side effects.",
  initialInstruction: "Implement the shipping quote function. Orders at or above $50 qualify for free shipping; otherwise shipping costs $5.99. Support a discount argument.",
  correction: "Apply the discount BEFORE checking the $50 threshold. Exactly $50 after discount qualifies; clamp the discounted subtotal at zero. Preserve the function signature."
};

// Authored demonstration fixtures, never represented as captured model responses.
export const BASELINE_CODE = `export function quoteShipping(subtotalCents, discountCents) {
  return subtotalCents >= 5000 ? 0 : 599;
}\n`;
export const CORRECTED_CODE = `export function quoteShipping(subtotalCents, discountCents) {
  const payableCents = Math.max(0, subtotalCents - discountCents);
  return payableCents >= 5000 ? 0 : 599;
}\n`;

export const CASES = [
  { name: "Below the threshold", args: [4999, 0], expected: 599 },
  { name: "Exactly $50", args: [5000, 0], expected: 0 },
  { name: "Above the threshold", args: [7500, 0], expected: 0 },
  { name: "Discount crosses the threshold", args: [6000, 1500], expected: 599 },
  { name: "Discount leaves exactly $50", args: [6000, 1000], expected: 0 },
  { name: "Fully discounted order", args: [5000, 5000], expected: 599 },
  { name: "Empty order", args: [0, 0], expected: 599 }
];

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export const SUITE_HASH = sha256(JSON.stringify({ requirement: SCENARIO.requirement, cases: CASES }));
