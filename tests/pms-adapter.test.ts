import assert from "node:assert/strict";
import test from "node:test";
import { Beds24Adapter } from "../src/pms/Beds24Adapter";
import { createPmsAdapter } from "../src/pms/PmsFactory";
import { PmsHttpClient, PmsHttpResponse } from "../src/pms/PmsHttpClient";
import { PmsUnsupportedError } from "../src/pms/PmsAdapter";

class FakeHttp implements PmsHttpClient {
  calls: { method: string; url: string; body?: string; headers?: Record<string, string> }[] = [];
  responses: PmsHttpResponse[] = [];

  request(method: "GET" | "POST" | "PATCH" | "DELETE", url: string, headers?: Record<string, string>, body?: string) {
    this.calls.push({ method, url, headers, body });
    const response = this.responses.shift();
    if (!response) throw new Error("NO_FAKE_RESPONSE");
    return response;
  }
}

test("Beds24 getBooking normalizes booking data", () => {
  const http = new FakeHttp();
  http.responses.push({
    status: 200,
    body: JSON.stringify([
      {
        id: 12345,
        propertyId: 99,
        roomId: 7,
        status: "confirmed",
        arrival: "2026-12-10",
        departure: "2026-12-12",
        numAdult: 4,
        price: 72000,
        currency: "JPY",
        firstName: "Taro",
        lastName: "Guest",
      },
    ]),
  });
  const adapter = new Beds24Adapter({ token: "secret" }, http);
  const booking = adapter.getBooking("12345");
  assert.equal(booking?.id, "12345");
  assert.equal(booking?.adults, 4);
  assert.equal(booking?.guest?.firstName, "Taro");
  assert.match(http.calls[0].url, /\/v2\/bookings\?id=12345$/);
  assert.equal(http.calls[0].headers?.token, "secret");
});

test("Beds24 sendMessage uses booking messages endpoint", () => {
  const http = new FakeHttp();
  http.responses.push({ status: 200, body: "{}" });
  const adapter = new Beds24Adapter({ token: "secret" }, http);
  adapter.sendMessage("B1", "Welcome");
  assert.equal(http.calls[0].method, "POST");
  assert.match(http.calls[0].url, /\/bookings\/messages$/);
  assert.deepEqual(JSON.parse(http.calls[0].body ?? ""), [
    { bookingId: "B1", message: "Welcome" },
  ]);
});

test("Beds24 price update uses inventory calendar endpoint", () => {
  const http = new FakeHttp();
  http.responses.push({ status: 200, body: "{}" });
  const adapter = new Beds24Adapter({ token: "secret" }, http);
  adapter.updateDailyPrices([
    {
      propertyId: "P1",
      roomId: "R1",
      date: "2026-12-01",
      price: 52800,
      minStay: 2,
    },
  ]);
  assert.match(http.calls[0].url, /\/inventory\/calendar$/);
  const payload = JSON.parse(http.calls[0].body ?? "[]");
  assert.equal(payload[0].price, 52800);
  assert.equal(payload[0].minStay, 2);
});

test("AirHost and Lodgify share the contract but fail closed until API is configured", () => {
  for (const provider of ["airhost", "lodgify"] as const) {
    const adapter = createPmsAdapter({ provider }, new FakeHttp());
    assert.equal(adapter.capabilities().messagesWrite, false);
    assert.throws(() => adapter.getBooking("1"), PmsUnsupportedError);
  }
});

test("Mock adapter is replaceable without changing caller contract", () => {
  const adapter = createPmsAdapter({ provider: "mock" }, new FakeHttp());
  assert.equal(adapter.provider, "mock");
  assert.equal(adapter.capabilities().webhooks, true);
});
