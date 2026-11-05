import { test, expect, vi } from "vitest";
vi.mock("@/lib/meta.functions", () => ({ metaProxy: vi.fn() }));
import { extractJson } from "@/lib/carethread";
test("truncated array recovers complete objects", () => {
  expect(extractJson('[{"id":1,"a":"x"},{"id":2,"a":"y"},{"id":3,"a":"tr')).toEqual([{id:1,a:"x"},{id:2,a:"y"}]);
});
