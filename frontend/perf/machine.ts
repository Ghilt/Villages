import { spawn, spawnSync } from 'node:child_process';

/**
 * What the graphics card says of itself through `nvidia-smi`, when there is one: its name and driver, how busy it is,
 * and its clocks while a place is measured, because the same frame takes a quarter longer at one of its clock's steps
 * than at the next and much longer on a card idled down. Nothing on a machine without it.
 */
export interface Card {
  readonly name: string;
  readonly driver: string;
  /** Percent of the last sample the card was busy. */
  readonly busy: number;
}

export function cardNow(): Card | null {
  const asked = spawnSync(
    'nvidia-smi',
    ['--query-gpu=name,driver_version,utilization.gpu', '--format=csv,noheader,nounits'],
    { encoding: 'utf8' },
  );
  if (asked.status !== 0) return null;
  const [name, driver, busy] = asked.stdout
    .trim()
    .split(/\r?\n/)[0]!
    .split(',')
    .map((part) => part.trim());
  return { name: name ?? '', driver: driver ?? '', busy: Number(busy) };
}

/** The card's clocks while something runs: started, then stopped with its middle readings. */
export interface ClockWatch {
  stop(): { graphicsMhz: number; memoryMhz: number; busy: number } | null;
}

export function watchClocks(): ClockWatch {
  const lines: string[] = [];
  const watching = spawn(
    'nvidia-smi',
    ['--query-gpu=clocks.gr,clocks.mem,utilization.gpu', '--format=csv,noheader,nounits', '-lms', '200'],
    { stdio: ['ignore', 'pipe', 'ignore'] },
  );
  watching.on('error', () => undefined);
  watching.stdout?.on('data', (data: Buffer) =>
    lines.push(...data.toString().split(/\r?\n/).filter(Boolean)),
  );
  return {
    stop() {
      watching.kill();
      const rows = lines.map((line) => line.split(',').map((part) => Number(part.trim())));
      if (rows.length === 0) return null;
      const middle = (column: number) => {
        const sorted = rows.map((row) => row[column] ?? 0).sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)]!;
      };
      return { graphicsMhz: middle(0), memoryMhz: middle(1), busy: middle(2) };
    },
  };
}
