import { ensureMeiliExists } from "./downloadMeiliSearchRelease";
import { homedir } from "os";
import { join } from "path";
import { exists, readJSON, writeJSON } from "fs-extra";
import { exec, spawn, spawnSync } from "child_process";
import { nanoid } from "nanoid";
// @ts-ignore
import notifier from "node-notifier";

// 定义颜色代码
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

export const start = async () => {
  const meiliPath = await ensureMeiliExists();

  // 读取 ~/.docbase/data/config.json 获取 apikey
  const configPath = join(homedir(), ".docbase", "data", "config.json");

  if (!(await exists(configPath))) {
    const config = {
      meiliSearchConfig: {
        host: "http://localhost:7700",
        // 生成随机字符串
        apiKey: nanoid(),
      },
    };

    await writeJSON(configPath, config, { spaces: 2 });
  }

  const data = await readJSON(configPath, "utf-8");

  const apikey = data.meiliSearchConfig.apiKey;

  // 运行命令安装 docbase 最新版本
  spawnSync("bun", ["add", "-g", "docbase", "--latest"], { stdio: "inherit" });

  // 启动 MeiliSearch 并为其输出添加前缀
  const meiliProcess = spawn(meiliPath, ["--master-key", apikey], {
    stdio: ["inherit", "pipe", "pipe"],
    cwd: join(meiliPath, ".."),
  });

  meiliProcess.stdout.on("data", (data) => {
    console.log(`${GREEN}[MeiliSearch] ${data.toString()}${RESET}`);
  });

  meiliProcess.stderr.on("data", (data) => {
    console.error(`${RED}[MeiliSearch] ${data.toString()}${RESET}`);
  });

  // 启动 docbase 并为其输出添加前缀
  const docbaseProcess = spawn("bun", ["x", "docbase"], {
    stdio: ["inherit", "pipe", "pipe"],
  });

  docbaseProcess.stdout.on("data", (data) => {
    const msg = data.toString();

    if (msg.includes("http://localhost:3000")) {
      // 检测操作系统类型
      const isWindows = process.platform === "win32";
      const isMac = process.platform === "darwin";

      // 根据不同操作系统执行相应命令打开浏览器
      if (isWindows) {
        exec(`start http://localhost:3000`);
      } else if (isMac) {
        exec(`open http://localhost:3000`);
      } else {
        exec(`xdg-open http://localhost:3000`);
      }

      notifier.notify({
        title: "DocBase 已启动",
        subtitle: "点击查看",
        message: "密钥：" + apikey,
        icon: "https://docbase.cc/logo.svg",
        wait: true,
      });
    }

    console.log(`${GREEN}[Docbase] ${msg}${RESET}`);
  });

  docbaseProcess.stderr.on("data", (data) => {
    console.error(`${RED}[Docbase] ${data.toString()}${RESET}`);
  });
};

start();
