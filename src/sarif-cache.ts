import * as fs from "fs";
import * as path from "path";

import * as cache from "@actions/cache";

export type CacheKey = string;

function serializeKey(key: CacheKey) {
  return Buffer.from(key).toString("base64");
}
async function getSARIFCachePath(): Promise<string | undefined> {
  const runnerTemp = process.env.RUNNER_TEMP;
  if (runnerTemp === undefined) {
    return undefined;
  }
  return path.join(runnerTemp, "codeql-results-cache");
}

export async function saveSARIFResults(outputPath: string, key: CacheKey) {
  const sarifCachePath = await getSARIFCachePath();
  if (sarifCachePath === undefined) {
    return;
  }

  if (!fs.existsSync(sarifCachePath)) {
    await fs.promises.mkdir(sarifCachePath);
  }

  let outputSARIFNames = await fs.promises.readdir(outputPath);
  for (let outputSARIFName of outputSARIFNames) {
    let outputSARIFPath = path.join(outputPath, outputSARIFName);
    let cachedSARIFPath = path.join(
      sarifCachePath,
      path.relative(outputPath, outputSARIFPath)
    );
    await fs.promises.copyFile(outputSARIFPath, cachedSARIFPath);
  }

  await cache.saveCache([sarifCachePath], serializeKey(key));
}

export async function skipAnalysis(): Promise<boolean> {
  const sarifCachePath = await getSARIFCachePath();
  if (sarifCachePath === undefined) {
    return false;
  }

  let cachedSARIFPaths = await fs.promises.readdir(sarifCachePath);
  return cachedSARIFPaths.length > 0; // TODO
}

export async function restoreSARIFResults(key: CacheKey) {
  if (!key) {
    throw new Error(`Got invalid cache key: ${key}`);
  }
  const sarifCachePath = await getSARIFCachePath();
  if (sarifCachePath === undefined) {
    return;
  }

  await fs.promises.mkdir(sarifCachePath);
  await cache.restoreCache([sarifCachePath], serializeKey(key));
}

export async function copySARIFResults(outputPath: string) {
  const sarifCachePath = await getSARIFCachePath();
  if (sarifCachePath === undefined) {
    return;
  }

  let cachedSARIFNames = await fs.promises.readdir(sarifCachePath);
  for (let cachedSARIFName of cachedSARIFNames) {
    let cachedSARIFPath = path.join(sarifCachePath, cachedSARIFName);
    let outputSARIFPath = path.join(
      outputPath,
      path.relative(sarifCachePath, cachedSARIFPath)
    );
    await fs.promises.copyFile(cachedSARIFPath, outputSARIFPath);
  }
}

export function readKeyFromEnv(): string {
  return process.env["SARIF_CACHE_KEY"] || "";
}
