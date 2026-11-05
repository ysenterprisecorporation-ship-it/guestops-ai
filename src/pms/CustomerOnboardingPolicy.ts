/** Product onboarding requirements, independent from the Kasai migration test GAS. */
export type PmsProvider="beds24"|"airhost"|"lodgify";
export interface CustomerOnboardingPlan {
 pms:PmsProvider;
 requiredCustomerActions:string[];
 optionalIntegrations:string[];
 forbiddenPrerequisites:string[];
}
export function buildCustomerOnboardingPlan(pms:PmsProvider):CustomerOnboardingPlan{
 const valid:PmsProvider[]=["beds24","airhost","lodgify"];
 if(!valid.includes(pms))throw new Error("PMS_PROVIDER_UNSUPPORTED");
 return {
  pms,
  requiredCustomerActions:["AUTHORIZE_EXISTING_PMS","SELECT_PROPERTIES","APPROVE_OPERATING_MODE"],
  optionalIntegrations:["GOOGLE_CALENDAR_CLEANING"],
  forbiddenPrerequisites:["CREATE_GMAIL_ACCOUNT","CREATE_GOOGLE_APPS_SCRIPT","PASTE_GAS_SOURCE","SHARE_PERSONAL_GMAIL_PASSWORD"]
 };
}
export function assertNoConsumerGoogleSetup(plan:CustomerOnboardingPlan):void{
 if(plan.requiredCustomerActions.some(x=>/GMAIL|GOOGLE_APPS_SCRIPT|PASTE_GAS|PASSWORD/.test(x)))
  throw new Error("CUSTOMER_GOOGLE_SETUP_PROHIBITED");
}
