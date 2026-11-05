import assert from "node:assert/strict";import test from "node:test";
import {buildCustomerOnboardingPlan,assertNoConsumerGoogleSetup} from "../src/pms/CustomerOnboardingPolicy";
for(const provider of ["beds24","airhost","lodgify"] as const){
 test(provider+" onboarding never requires a new customer Gmail or Apps Script",()=>{
 const plan=buildCustomerOnboardingPlan(provider);
 assertNoConsumerGoogleSetup(plan);
 assert.equal(plan.requiredCustomerActions.length,3);
 assert.ok(!plan.requiredCustomerActions.some(s=>s.includes("GMAIL")||s.includes("GAS")));
 });
}
test("reject a regression requiring customers to create Gmail accounts",()=>{
 const plan=buildCustomerOnboardingPlan("beds24");
 plan.requiredCustomerActions.push("CREATE_GMAIL_ACCOUNT");
 assert.throws(()=>assertNoConsumerGoogleSetup(plan));
});
