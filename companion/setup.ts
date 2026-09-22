import { mkdirSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { HOST_NAME } from "./protocol";

/** Writes reviewable installation files only. Never changes browser/OS registration. */
const { values } = parseArgs({ options: { "extension-id": { type: "string" }, browser: { type: "string", default: "chrome" } }, strict: true });
const extensionId = values["extension-id"];
if (!extensionId || !/^[a-p]{32}$/.test(extensionId)) throw new Error("Pass --extension-id followed by your 32-character unpacked extension ID.");
if (values.browser !== "chrome" && values.browser !== "edge") throw new Error("Browser must be chrome or edge.");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const local = join(root, "companion", "local");
const configPath = join(root, "companion", "local-config.json");
if (existsSync(configPath) || existsSync(local)) throw new Error("Setup files already exist. Review/move them before generating another installation; existing setup is never overwritten.");
mkdirSync(local, { recursive: true });
writeFileSync(configPath, JSON.stringify({ allowedOrigins: [`chrome-extension://${extensionId}/`] }, null, 2) + "\n", { flag: "wx" });
const manifestPath = join(local, `${HOST_NAME}.json`);
const launcher = join(local, process.platform === "win32" ? "lossless-host.exe" : "lossless-host");
writeFileSync(manifestPath, JSON.stringify({ name: HOST_NAME, description: "Lossless Rewrite local engine", path: launcher, type: "stdio", allowed_origins: [`chrome-extension://${extensionId}/`] }, null, 2));
const node = process.execPath;
const host = join(root, "companion", "host.ts");
const tsx = pathToFileURL(join(root, "node_modules", "tsx", "dist", "loader.mjs")).href;
if (process.platform === "win32") {
  // Compile a real executable: relying on cmd/bat native hosts varies by Chrome version.
  const cs = (value: string) => JSON.stringify(value);
  const source = `using System;
using System.Diagnostics;
using System.IO;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
class Host {
  static void Pump(Stream input, Stream output) {
    byte[] buffer = new byte[16384];
    int count;
    while((count = input.Read(buffer, 0, buffer.Length)) > 0) {
      output.Write(buffer, 0, count);
      output.Flush();
    }
  }
  static int Main(string[] args) {
    if(args.Length < 1 || !Regex.IsMatch(args[0], @"^chrome-extension://[a-p]{32}/$")) return 1;
    var start = new ProcessStartInfo();
    start.FileName = ${cs(node)};
    start.WorkingDirectory = ${cs(root)};
    start.Arguments = ${cs(`--import "${tsx}" "${host}" `)} + args[0];
    start.UseShellExecute = false;
    start.CreateNoWindow = true;
    start.RedirectStandardInput = true;
    start.RedirectStandardOutput = true;
    start.RedirectStandardError = true;
    using(var child = Process.Start(start)) {
      var input = Task.Run(() => { try { Pump(Console.OpenStandardInput(), child.StandardInput.BaseStream); child.StandardInput.Close(); } catch {} });
      var output = Task.Run(() => Pump(child.StandardOutput.BaseStream, Console.OpenStandardOutput()));
      var error = Task.Run(() => Pump(child.StandardError.BaseStream, Console.OpenStandardError()));
      child.WaitForExit();
      Task.WaitAll(output, error);
      return child.ExitCode;
    }
  }
}`;
  writeFileSync(join(local, "Launcher.cs"), source);
  const ps = (value: string) => "'" + value.replaceAll("'", "''") + "'";
  writeFileSync(join(local, "build-launcher.ps1"), `$ErrorActionPreference = 'Stop'\n$csc = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'\nif (-not (Test-Path -LiteralPath $csc)) { throw 'The .NET Framework C# compiler is required to build this launcher.' }\n& $csc '/nologo' '/target:exe' ${ps(`/out:${launcher}`)} ${ps(join(local, "Launcher.cs"))}\nif ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed' }\n`);
  const key = `HKCU:\\Software\\${values.browser === "edge" ? "Microsoft\\Edge" : "Google\\Chrome"}\\NativeMessagingHosts\\${HOST_NAME}`;
  writeFileSync(join(local, "register.ps1"), `$ErrorActionPreference = 'Stop'\nif (-not (Test-Path -LiteralPath ${ps(launcher)})) { throw 'Run build-launcher.ps1 first.' }\n$key = ${ps(key)}\nif (Test-Path -LiteralPath $key) { throw 'A host is already registered. Review it before replacing it.' }\nNew-Item -Path $key -Force | Out-Null\nSet-Item -LiteralPath $key -Value ${ps(manifestPath)}\nWrite-Host 'Registered Lossless for this user only.'\n`);
  writeFileSync(join(local, "unregister.ps1"), `$ErrorActionPreference = 'Stop'\n$key = ${ps(key)}\nif (Test-Path -LiteralPath $key) {\n  if ((Get-Item -LiteralPath $key).GetValue('') -ne ${ps(manifestPath)}) { throw 'Registration belongs to a different installation.' }\n  Remove-Item -LiteralPath $key\n}\n`);
} else {
  const sh = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
  writeFileSync(launcher, `#!/bin/sh\ncd ${sh(root)} || exit 1\nexec ${sh(node)} --import ${sh(tsx)} ${sh(host)} "$@"\n`);
  chmodSync(launcher, 0o700);
  const directory = process.platform === "darwin" ? (values.browser === "edge" ? "Library/Application Support/Microsoft Edge/NativeMessagingHosts" : "Library/Application Support/Google/Chrome/NativeMessagingHosts") : (values.browser === "edge" ? ".config/microsoft-edge/NativeMessagingHosts" : ".config/google-chrome/NativeMessagingHosts");
  writeFileSync(join(local, "register.sh"), `#!/bin/sh\nset -eu\ndestination="$HOME/${directory}/${HOST_NAME}.json"\nif [ -e "$destination" ]; then echo 'A host is already registered; review it first.' >&2; exit 1; fi\nmkdir -p "$HOME/${directory}"\ncp ${sh(manifestPath)} "$destination"\n`);
  writeFileSync(join(local, "unregister.sh"), `#!/bin/sh\nset -eu\ndestination="$HOME/${directory}/${HOST_NAME}.json"\nif [ -e "$destination" ]; then\n  cmp -s ${sh(manifestPath)} "$destination" || { echo 'Different installation; refusing removal.' >&2; exit 1; }\n  rm -- "$destination"\nfi\n`);
}
process.stdout.write(`Generated setup in ${local}. Nothing was registered. Read companion/README.md before running the generated installation scripts.\n`);
