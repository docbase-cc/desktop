import { downloadRelease } from "@terascope/fetch-github-release";
import { arch, homedir, platform } from "os";
import { isArray } from "es-toolkit/compat";
import { join } from "path";
import { ensureDir, exists } from "fs-extra";

// 下载最新 dufs
const user = "meilisearch";
const repo = "meilisearch";
const leaveZipped = true;
const disableLogging = false;

const getName = () => {
  const p = platform();
  const a = arch();

  if (p === "win32") {
    if (a !== "x64") throw new Error("windows only support x64");
    return "meilisearch-windows-amd64.exe";
  } else if (p === "darwin") {
    if (a === "arm64") {
      return "meilisearch-macos-apple-silicon";
    } else if (a === "x64") {
      return "meilisearch-macos-amd64";
    } else {
      throw new Error("macos only support arm64 and x64");
    }
  } else if (p === "linux") {
    if (a === "arm64") {
      return "meilisearch-linux-aarch64";
    } else if (a === "x64") {
      return "meilisearch-linux-amd64";
    } else {
      throw new Error("linux only support arm64 and x64");
    }
  } else {
    throw new Error("unsupported platform");
  }
};

export const ensureMeiliExists = async () => {
  // 确保 ~/.docbase/meilisearch 目录存在
  const targetPath = join(homedir(), ".docbase", repo);
  await ensureDir(targetPath);

  // 获取二进制文件的名称
  const name = getName();
  // meilisearch 二进制文件的完整路径
  const targetName = join(targetPath, name);

  const ex = await exists(targetName);

  if (!ex) {
    // 下载最新的 release
    const names = await downloadRelease(
      user,
      repo,
      targetPath,
      (release) => release.prerelease === false,
      (asset) => asset.name === name,
      leaveZipped,
      disableLogging
    );

    if (targetName !== (isArray(names) ? names : names.assetFileNames).at(0)!) {
      throw new Error("download failed");
    }
  }

  // 返回是否成功
  return targetName;
};
