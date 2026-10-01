import { spawn } from "node:child_process";

import type { CommandResult } from "@zui-webos/shared-types";

export interface ProcessRequest {
  readonly executable: string;
  readonly args: readonly string[];
  readonly timeoutMs: number;
  readonly env?: NodeJS.ProcessEnv;
}

export interface ProcessRunner {
  run(request: ProcessRequest): Promise<CommandResult>;
}

const MAX_CAPTURE_BYTES = 1024 * 1024;

export class NodeProcessRunner implements ProcessRunner {
  run(request: ProcessRequest): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const startedAt = performance.now();
      let stdout = "";
      let stderr = "";
      let timedOut = false;

      const child = spawn(request.executable, [...request.args], {
        env: request.env ?? process.env,
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, request.timeoutMs);

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        stdout = `${stdout}${chunk}`.slice(-MAX_CAPTURE_BYTES);
      });
      child.stderr.on("data", (chunk: string) => {
        stderr = `${stderr}${chunk}`.slice(-MAX_CAPTURE_BYTES);
      });

      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once("close", (exitCode) => {
        clearTimeout(timer);
        resolve({
          executable: request.executable,
          args: request.args,
          exitCode,
          stdout,
          stderr,
          durationMs: Math.round(performance.now() - startedAt),
          timedOut,
        });
      });
    });
  }
}
