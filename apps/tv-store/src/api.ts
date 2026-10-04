import { mockTvStoreCatalog } from "./mock.js";
import type { TvStoreCatalogResponse, TvStoreProduct } from "./contracts.js";

const LOGICAL_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
export interface TvStoreDataProvider {
  catalog(): Promise<TvStoreCatalogResponse>;
}

export class MockTvStoreDataProvider implements TvStoreDataProvider {
  catalog(): Promise<TvStoreCatalogResponse> {
    return Promise.resolve(mockTvStoreCatalog);
  }
}

export class TvStoreApi {
  constructor(private readonly provider: TvStoreDataProvider) {}
  catalog(): Promise<TvStoreCatalogResponse> {
    return this.provider.catalog();
  }
  async product(id: string): Promise<TvStoreProduct> {
    if (id.length > 96 || !LOGICAL_ID.test(id))
      throw Object.assign(
        new Error("Product ID must be a logical catalog identifier."),
        {
          code: "INVALID_PRODUCT_ID",
          status: 400,
        },
      );
    const product = (await this.catalog()).products.find(
      (item) => item.productId === id,
    );
    if (product === undefined)
      throw Object.assign(new Error("Catalog product was not found."), {
        code: "PRODUCT_NOT_FOUND",
        status: 404,
      });
    return product;
  }
}
