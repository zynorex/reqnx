import { createMemoryStore } from '@reqnx/core';
import { runStoreContractSuite, type StoreHarness } from '../conformance.js';

const memoryStoreHarness: StoreHarness = {
  name: 'MemoryStore',
  create(options) {
    return createMemoryStore(options?.clock ? { clock: options.clock } : undefined);
  },
  cleanup(store) {
    return store.close();
  },
};

runStoreContractSuite(memoryStoreHarness);
