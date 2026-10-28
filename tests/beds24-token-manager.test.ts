import assert from "node:assert/strict";
import test from "node:test";
import { Beds24TokenManager } from "../src/pms/Beds24TokenManager";
import { PmsHttpClient } from "../src/pms/PmsHttpClient";
function setup(status=200,body='{"token":"access-v2","refreshToken":"refresh-v2","expiresIn":86400}') {
 const state:Record<string,string>={BEDS24_REFRESH_TOKEN:"refresh-initial"};
 let calls=0;
 const http:PmsHttpClient={request:(method,url,headers)=>{
  calls++;
  assert.equal(method,"GET");assert.match(url,/\/authentication\/token$/);
  assert.equal(headers?.refreshToken,"refresh-initial");
  return {status,body};
 }};
 return {manager:new Beds24TokenManager(http,{get:key=>state[key]??"",set:(key,value)=>{state[key]=value;}}),
  state,get calls(){return calls;}};
}
test("Beds24 refresh token exchanges for a cached expiring access token",()=>{
 const s=setup();assert.equal(s.manager.accessToken(1000),"access-v2");
 assert.equal(s.manager.accessToken(2000),"access-v2");
 assert.equal(s.calls,1);assert.equal(s.state.BEDS24_REFRESH_TOKEN,"refresh-v2");
});
test("malformed token refresh fails before using credentials",()=>{
 const s=setup(200,'{"token":"","expiresIn":0}');
 assert.throws(()=>s.manager.accessToken(1000),/TOKEN_RESPONSE_INVALID/);
});
test("HTTP unauthorized is redacted and throws",()=>{
 const s=setup(401,'{"token":"confidential"}');
 assert.throws(()=>s.manager.accessToken(1000),/PMS_HTTP_ERROR/);
});
