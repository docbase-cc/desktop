import z from "zod";
import { arch, platform } from "os";
import { resolve, basename } from "path";
import { pack } from "7zip-min";
import { mkdir, rm } from "fs-extra";
import { execa } from "execa";

// https://bun.sh/docs/bundler/executables
const platforms = z.enum([
  "linux-x64",
  "linux-arm64",
  "windows-x64",
  "darwin-x64",
  "darwin-arm64",
  "linux-x64-musl",
  "linux-arm64-musl",
]);

const allPlatforms = z.array(platforms).or(z.literal("all")).optional();

const inputType = z.strictObject({
  inputFile: z.string(),
  target: allPlatforms,
  name: z.string().optional(),
  hideConsole: z.boolean().optional(),
  icon: z.string().optional(),
  bytecode: z.boolean().optional(),
  compress: z.boolean().optional(),
  outputDir: z.string().optional(),
});

type Input = z.infer<typeof inputType>;

export const vs = Object.values(platforms.Values);

export const compile = async (params: Input) => {
  // 检测是否有 bun 命令
  try {
    await execa("bun", ["--version"]);
  } catch (error) {
    throw new Error("Bun not found, please install it first.");
  }

  const {
    target,
    outputDir: output,
    inputFile: input,
    compress,
    hideConsole,
    icon,
    name,
    bytecode,
  } = inputType.parse(params);

  // 获取当前系统和架构
  const currentPlatform = platform();
  const currentArch = arch();

  // 构建目标平台和架构的字符串
  const targetPlatformArch = target ?? [
    `${currentPlatform.replace("win32", "windows")}-${currentArch}`,
  ];

  // 目标平台和架构
  const tgs =
    targetPlatformArch === "all"
      ? vs
      : Array.from(new Set(targetPlatformArch).values());

  // 输出文件夹路径
  const o = resolve(output ?? "compile");

  // 获取文件名
  const fileName = name ?? "main";
  // 输出文件名
  const outs = tgs.map((v) => resolve(o, `${fileName}-${v}`));

  // 打包命令
  const cmds = tgs.map((v, index) => {
    const isWin32Platform = (a: string) => (v.includes("windows") ? a : "");

    const cmd =
      `bun build` +
      isWin32Platform(`${hideConsole ? " --windows-hide-console " : " "}`) +
      isWin32Platform(`${icon ? ` --windows-icon=${icon} ` : " "}`) +
      `${bytecode ? ` --bytecode ` : " "}` +
      `--compile --minify --sourcemap --target=bun-${v} --outfile "${outs[index]}" ${input}`;
    return {
      outFile: outs[index],
      platform: v,
      cmd,
    };
  });

  // 删除并创建目录
  await rm(o, { force: true, recursive: true });
  await mkdir(o, { recursive: true });

  // 并发执行命令
  await Promise.all(
    cmds.map(async (v) => {
      await execa(v.cmd, { shell: true });

      if (compress && v.outFile) {
        const source = `${v.outFile}${
          v.platform.startsWith("windows") ? ".exe" : ""
        }`;
        const targetDir = resolve(o, "compressed");
        await mkdir(targetDir, { recursive: true });
        const target = resolve(targetDir, `${basename(v.outFile)}.7z`);

        // 压缩文件
        await pack(source, target);
      }
    })
  );
};

await compile({
  inputFile: "src/index.ts",
  target: "all",
  name: "DocBase",
  hideConsole: true,
  bytecode: true,
  compress: true,
});
