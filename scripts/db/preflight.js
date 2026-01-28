#!/usr/bin/env node
const path = require("node:path");
const dns = require("node:dns").promises;
const net = require("node:net");
const { resolvePublicDNS } = require("./resolve-public-dns");
const { execFile } = require("node:child_process");

require(path.join(__dirname, "..", "load-env.js"));

function fail(message) {
  console.error(`[db:preflight] ${message}`);
  process.exit(1);
}

const required = ["DATABASE_URL", "DIRECT_URL"];
const missing = required.filter((key) => !process.env[key] || String(process.env[key]).trim() === "");
if (missing.length > 0) {
  fail(`Missing required env vars: ${missing.join(", ")}`);
}

let directUrl;
let databaseUrl;
try {
  directUrl = new URL(process.env.DIRECT_URL);
  databaseUrl = new URL(process.env.DATABASE_URL);
} catch (err) {
  fail(`Invalid URL in DATABASE_URL/DIRECT_URL: ${(err && err.message) || err}`);
}

const rawHostname = (directUrl.hostname || "").trim().replace(/\.$/, "");
const port = Number(directUrl.port || "5432");
const hostRegex = /^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))*$/;
const hasWhitespace = /\s/.test(rawHostname);
const containsColon = rawHostname.includes(":");
console.log(
  `[db:preflight] hostProbe rawHostJSON=${JSON.stringify(rawHostname)} len=${rawHostname.length} hasWhitespace=${hasWhitespace} containsColon=${containsColon}`,
);
if (!rawHostname) {
  fail("DIRECT_URL must include hostname");
}
if (containsColon) {
  fail("HOST CONTAINS PORT — use hostname only");
}
if (!hostRegex.test(rawHostname)) {
  fail(`Invalid hostname format: ${JSON.stringify(rawHostname)}`);
}
if (!port) {
  fail("DIRECT_URL must include port");
}

const ipRegex = /^(?:\d{1,3}\.){3}\d{1,3}$|:/;

function execDig(args, timeoutMs = 2000) {
  return new Promise((resolve) => {
    execFile("dig", args, { timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err && err.code === "ENOENT") {
        resolve({ available: false, ok: false, ips: [], code: "ENOENT", stdout, stderr, cmd: `dig ${args.join(" ")}` });
        return;
      }
      if (err) {
        resolve({ available: true, ok: false, ips: [], code: err.code || "DIG_FAIL", stdout, stderr, cmd: `dig ${args.join(" ")}` });
        return;
      }
      const lines = String(stdout || "")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && ipRegex.test(l));
      resolve({ available: true, ok: lines.length > 0, ips: lines, code: null, stdout, stderr, cmd: `dig ${args.join(" ")}` });
    });
  });
}

async function checkDns(hostname) {
  let systemOk = false;
  let publicOk = false;
  let systemCode = null;
  let publicCode = null;
  let publicIp = null;
  let publicProvider = null;
  let systemSource = "dig";
  let publicSource = "dig";

  const digSystem = await execDig(["+short", hostname]);
  if (digSystem.available) {
    systemOk = digSystem.ok;
    systemCode = digSystem.ok ? null : digSystem.code;
  } else {
    systemSource = "node-dns";
    try {
      await dns.resolve4(hostname);
      systemOk = true;
    } catch (err) {
      systemOk = false;
      systemCode = err && err.code;
    }
  }

  const digPublic1 = await execDig(["@1.1.1.1", "+short", hostname]);
  let digPublic2 = { available: false, ok: false };
  if (digPublic1.available && digPublic1.ok) {
    publicOk = true;
    publicIp = digPublic1.ips[0];
    publicProvider = "dig@1.1.1.1";
  } else {
    digPublic2 = await execDig(["@8.8.8.8", "+short", hostname]);
    if (digPublic2.available && digPublic2.ok) {
      publicOk = true;
      publicIp = digPublic2.ips[0];
      publicProvider = "dig@8.8.8.8";
    } else if (!digPublic1.available && !digPublic2.available) {
      publicSource = "node-dns-json";
      const publicRes = await resolvePublicDNS(hostname);
      publicOk = publicRes.ok;
      publicIp = publicRes.ips && publicRes.ips[0];
      publicCode = publicRes.code;
      publicProvider = publicRes.provider;
    } else {
      publicOk = false;
      publicCode = digPublic1.code || digPublic2.code;
    }
  }

  return {
    systemOk,
    publicOk,
    publicIp,
    systemCode,
    publicCode,
    publicProvider,
    systemSource,
    publicSource,
    digSystem,
    digPublic1,
    digPublic2,
  };
}

function checkTcp(hostname, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: hostname, port: Number(port), timeout: 2000 }, () => {
      socket.end();
      resolve({ ok: true, code: null });
    });
    socket.on("error", (err) => {
      resolve({ ok: false, code: err && err.code });
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ ok: false, code: "ETIMEDOUT" });
    });
  });
}

(async () => {
  const delaysMs = [500, 1000, 2000];
  for (let attempt = 0; attempt <= delaysMs.length; attempt += 1) {
    const dnsResult = await checkDns(rawHostname);
    const dnsSystem = dnsResult.systemOk ? "OK" : "FAIL";
    const dnsPublic = dnsResult.publicOk ? "OK" : "FAIL";
    const resolveOk = dnsResult.publicOk || dnsResult.systemOk;
    const tcpResult = resolveOk ? await checkTcp(rawHostname, port) : { ok: false, code: "SKIP" };
    const tcpStatus = tcpResult.ok ? "OK" : tcpResult.code || "FAIL";

    if (resolveOk && tcpResult.ok) {
      console.log(
        `[db:preflight] OK host=${rawHostname} port=${port} DNS(system)=${dnsSystem} DNS(public)=${dnsPublic} TCP=${tcpStatus} publicIp=${dnsResult.publicIp || "-"} publicProvider=${dnsResult.publicProvider || "-"} systemSource=${dnsResult.systemSource} publicSource=${dnsResult.publicSource}`,
      );
      process.exit(0);
    }

    if (!dnsResult.publicOk && !dnsResult.systemOk) {
      fail(
        `DNS_UNAVAILABLE host=${rawHostname} DNS(system)=${dnsSystem} DNS(public)=${dnsPublic} systemCode=${dnsResult.systemCode || "-"} publicCode=${dnsResult.publicCode || "-"} platform=${process.platform} node=${process.version} rawHostJSON=${JSON.stringify(rawHostname)} systemSource=${dnsResult.systemSource} publicSource=${dnsResult.publicSource}\n` +
          `[db:preflight] ${dnsResult.digSystem?.cmd} exitCode=${dnsResult.digSystem?.code || "-"} stdout=${JSON.stringify(dnsResult.digSystem?.stdout || "")} stderr=${JSON.stringify(dnsResult.digSystem?.stderr || "")}\n` +
          `[db:preflight] ${dnsResult.digPublic1?.cmd} exitCode=${dnsResult.digPublic1?.code || "-"} stdout=${JSON.stringify(dnsResult.digPublic1?.stdout || "")} stderr=${JSON.stringify(dnsResult.digPublic1?.stderr || "")}\n` +
          `[db:preflight] ${dnsResult.digPublic2?.cmd} exitCode=${dnsResult.digPublic2?.code || "-"} stdout=${JSON.stringify(dnsResult.digPublic2?.stdout || "")} stderr=${JSON.stringify(dnsResult.digPublic2?.stderr || "")}`,
      );
    }

    if (!dnsResult.systemOk && dnsResult.publicOk) {
      if (attempt < delaysMs.length) {
        console.warn(
          `[db:preflight] DNS_LOCAL_ISSUE host=${rawHostname} DNS(system)=FAIL DNS(public)=OK TCP=${tcpStatus} publicIp=${dnsResult.publicIp || "-"} publicProvider=${dnsResult.publicProvider || "-"} retry=${delaysMs[attempt]}ms`,
        );
        await new Promise((r) => setTimeout(r, delaysMs[attempt]));
        continue;
      }
      fail(
        `DNS_LOCAL_ISSUE host=${rawHostname} DNS(system)=FAIL DNS(public)=OK TCP=${tcpStatus} publicIp=${dnsResult.publicIp || "-"} publicProvider=${dnsResult.publicProvider || "-"}`,
      );
    }

    if (!tcpResult.ok) {
      if (attempt < delaysMs.length) {
        console.warn(
          `[db:preflight] NETWORK_BLOCK host=${rawHostname}:${port} TCP=${tcpStatus} retry=${delaysMs[attempt]}ms`,
        );
        await new Promise((r) => setTimeout(r, delaysMs[attempt]));
        continue;
      }
      fail(
        `NETWORK_BLOCK host=${rawHostname}:${port} TCP=${tcpStatus}`,
      );
    }
  }
})();
