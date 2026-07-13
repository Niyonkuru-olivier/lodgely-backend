import { execSync } from 'child_process';

/**
 * Kill any process listening on the given TCP port.
 * Prevents Nest EADDRINUSE when a previous backend instance was not shut down.
 */
export function freePort(port: number): void {
  const target = Number(port) || 5000;

  if (process.platform === 'win32') {
    try {
      const stdout = execSync(`netstat -ano | findstr :${target}`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const pids = new Set<string>();
      for (const line of stdout.split(/\r?\n/)) {
        if (!line.includes('LISTENING')) continue;
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== '0' && pid !== String(process.pid)) {
          pids.add(pid);
        }
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
          console.log(`[free-port] Freed port ${target} (stopped PID ${pid})`);
        } catch {
          // Process may have already exited
        }
      }
    } catch {
      // No listeners found
    }
    return;
  }

  try {
    const stdout = execSync(`lsof -ti tcp:${target} -sTCP:LISTEN`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    for (const pid of stdout.trim().split('\n').filter(Boolean)) {
      if (pid === String(process.pid)) continue;
      try {
        process.kill(Number(pid), 'SIGKILL');
        console.log(`[free-port] Freed port ${target} (stopped PID ${pid})`);
      } catch {
        // Already gone
      }
    }
  } catch {
    // No listeners found
  }
}
