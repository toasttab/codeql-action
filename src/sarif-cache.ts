import * as fs from "fs";
import * as path from "path";

import * as cache from "@actions/cache";
import { Logger } from "./logging";

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

export async function saveSARIFResults(
  outputPath: string,
  key: CacheKey,
  logger: Logger
) {
  const sarifCachePath = await getSARIFCachePath();
  if (sarifCachePath === undefined) {
    throw new Error("XXX Early return in saveSARIFResults");
    // return
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
    logger.info(`Copying file ${outputSARIFPath} to cached ${cachedSARIFPath}`);
    await fs.promises.copyFile(outputSARIFPath, cachedSARIFPath);
  }

  logger.info(`Performing saveCache(${sarifCachePath}, ${key})`);
  await cache.saveCache([sarifCachePath], serializeKey(key));
}

export async function skipAnalysis(): Promise<boolean> {
  const sarifCachePath = await getSARIFCachePath();
  if (sarifCachePath === undefined) {
    throw new Error("XXX Early return in skipAnalysis");
    // return false;
  }

  let cachedSARIFPaths = await fs.promises.readdir(sarifCachePath);
  return cachedSARIFPaths.length > 0; // TODO
}

export async function restoreSARIFResults(key: CacheKey, logger: Logger) {
  if (!key) {
    throw new Error(`Got invalid cache key: ${key}`);
  }
  const sarifCachePath = await getSARIFCachePath();
  if (sarifCachePath === undefined) {
    throw new Error("XXX Early return in restoreSARIFResults");
    // return
  }

  await fs.promises.mkdir(sarifCachePath);
  logger.info(`Performing restoreCache(${sarifCachePath}, ${key})`);
  await cache.restoreCache([sarifCachePath], serializeKey(key));
}

export async function copySARIFResults(outputPath: string, logger: Logger) {
  const sarifCachePath = await getSARIFCachePath();
  if (sarifCachePath === undefined) {
    throw new Error("XXX Early return in copySARIFResults");
    // return
  }

  let cachedSARIFNames = await fs.promises.readdir(sarifCachePath);
  if (cachedSARIFNames.length === 0) {
    throw new Error(`Cache directory ${outputPath} is empty!`);
  }
  logger.info(
    `Copying cached [${cachedSARIFNames.join(", ")}] to ${outputPath}`
  );
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
