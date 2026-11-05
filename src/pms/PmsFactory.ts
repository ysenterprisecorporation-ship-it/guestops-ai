import { Beds24Adapter } from "./Beds24Adapter";
import { MockPmsAdapter } from "./MockPmsAdapter";
import { PmsAdapter, PmsConfigurationError, PmsProvider } from "./PmsAdapter";
import { GasPmsHttpClient, PmsHttpClient } from "./PmsHttpClient";
import { UnsupportedApiAdapter } from "./UnsupportedApiAdapter";

export interface PmsFactoryConfig {
  provider: PmsProvider;
  beds24Token?: string;
}

export function createPmsAdapter(
  config: PmsFactoryConfig,
  http: PmsHttpClient = new GasPmsHttpClient(),
): PmsAdapter {
  switch (config.provider) {
    case "beds24":
      if (!config.beds24Token)
        throw new PmsConfigurationError("BEDS24_TOKEN_MISSING");
      return new Beds24Adapter({ token: config.beds24Token }, http);
    case "airhost":
      // API利用条件・契約が満たされた時点でこの差替え枠へ実装する。
      return new UnsupportedApiAdapter("airhost");
    case "lodgify":
      // 現在契約/API仕様が確認できた時点でこの差替え枠へ実装する。
      return new UnsupportedApiAdapter("lodgify");
    case "mock":
      return new MockPmsAdapter();
  }
}
