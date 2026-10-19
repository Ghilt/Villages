import { execFileSync } from 'node:child_process';

/**
 * Which programs have a folder's files open: what keeps Windows from renaming the folder until they let go. Asked of
 * Windows itself, so a borrow that waits says who it waits for rather than guessing (decision record 0095, its
 * amendment of 2026-10-18).
 *
 * Windows will say which processes have a file open, but at about fifty milliseconds a file, a quarter of an hour for a
 * folder of tiles. So every entry is first opened for reading with no sharing, which is refused at once when anything
 * else has it open, and only twenty of those refused, with the folder and the folders directly in it, where a watcher
 * would hold one, are asked about. Seven seconds for twenty-two thousand entries.
 */

/** A program with entries of the folder open, and how many of those asked about it holds. */
export interface Holder {
  pid: number;
  name: string;
  entries: number;
}

export interface Holding {
  /** The files and folders looked at, the folder itself among them. */
  looked: number;
  /** How many of them something else had open. */
  open: number;
  holders: Holder[];
}

const ASK = String.raw`
Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
public static class Holders {
  [StructLayout(LayoutKind.Sequential)] struct IoStatus { public IntPtr Status; public IntPtr Information; }
  [DllImport("ntdll.dll")] static extern int NtQueryInformationFile(SafeFileHandle h, out IoStatus io, IntPtr info, int len, int cls);
  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern SafeFileHandle CreateFile(string name, uint access, uint share, IntPtr sa, uint disp, uint flags, IntPtr tmpl);
  const uint READ = 0x80000000, READ_ATTRIBUTES = 0x80, SHARE_ALL = 7, OPEN_EXISTING = 3, BACKUP_SEMANTICS = 0x02000000;
  const int SHARING_VIOLATION = 32, PROCESS_IDS_USING_FILE = 47;
  public static IEnumerable<string> Of(string folder, long me) {
    var all = new List<string> { folder };
    all.AddRange(Directory.EnumerateFileSystemEntries(folder, "*", SearchOption.AllDirectories));
    var open = new List<string>();
    foreach (var path in all) {
      using (var h = CreateFile(path, READ, 0, IntPtr.Zero, OPEN_EXISTING, BACKUP_SEMANTICS, IntPtr.Zero)) {
        if (h.IsInvalid && Marshal.GetLastWin32Error() == SHARING_VIOLATION) open.Add(path);
      }
    }
    yield return "looked\t" + all.Count + "\t" + open.Count;
    var asked = new HashSet<string>(open.GetRange(0, Math.Min(open.Count, 20)));
    asked.Add(folder);
    foreach (var inside in Directory.EnumerateDirectories(folder)) asked.Add(inside);
    var by = new Dictionary<long, int>();
    var buffer = Marshal.AllocHGlobal(65536);
    try {
      foreach (var path in asked) {
        using (var h = CreateFile(path, READ_ATTRIBUTES, SHARE_ALL, IntPtr.Zero, OPEN_EXISTING, BACKUP_SEMANTICS, IntPtr.Zero)) {
          IoStatus io;
          if (h.IsInvalid || NtQueryInformationFile(h, out io, buffer, 65536, PROCESS_IDS_USING_FILE) != 0) continue;
          int count = Marshal.ReadInt32(buffer);
          for (int i = 0; i < count; i++) {
            long pid = Marshal.ReadIntPtr(buffer, IntPtr.Size + i * IntPtr.Size).ToInt64();
            if (pid == me) continue;
            int had; by.TryGetValue(pid, out had); by[pid] = had + 1;
          }
        }
      }
    } finally { Marshal.FreeHGlobal(buffer); }
    foreach (var pair in by) yield return "pid\t" + pair.Key + "\t" + pair.Value;
  }
}
"@
foreach ($line in [Holders]::Of($env:VILLAGES_HOLDERS_OF, $PID)) {
  if ($line.StartsWith("pid")) {
    $line + [char]9 + (Get-Process -Id ([int]($line -split [char]9)[1]) -ErrorAction SilentlyContinue).ProcessName
  } else { $line }
}
`;

/**
 * Who has anything in `folder` open, besides this lookup: undefined where Windows cannot be asked, off Windows or
 * when the asking fails.
 */
export function whoHolds(folder: string): Holding | undefined {
  if (process.platform !== 'win32') return undefined;
  let said: string;
  try {
    said = execFileSync(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(ASK, 'utf16le').toString('base64')],
      {
        encoding: 'utf8',
        env: { ...process.env, VILLAGES_HOLDERS_OF: folder },
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 60_000,
        windowsHide: true,
      },
    );
  } catch {
    return undefined;
  }
  const held: Holding = { looked: 0, open: 0, holders: [] };
  for (const line of said.split(/\r?\n/)) {
    const [kind, one, two, name] = line.split('\t');
    if (kind === 'looked') {
      held.looked = Number(one);
      held.open = Number(two);
    } else if (kind === 'pid') {
      held.holders.push({ pid: Number(one), name: name ?? '', entries: Number(two) });
    }
  }
  return held;
}

const KNOWN: Record<string, string> = {
  MsMpEng: 'Windows Defender',
  SearchIndexer: 'Windows Search',
  SearchProtocolHost: 'Windows Search',
  SearchFilterHost: 'Windows Search',
  explorer: 'Explorer',
  warp: 'the Warp terminal',
};

/** What `whoHolds` found, in words for the end of a line: who holds the folder, and how much of it is open. */
export function holdersSaid(held: Holding): string {
  const many = (count: number) => count.toLocaleString('en-GB');
  const everything = `${many(held.looked)} files and folders`;
  if (held.holders.length === 0) {
    return `nothing else had any of its ${everything} open by the time it was asked`;
  }
  const who = held.holders.map(({ pid, name }) =>
    name === ''
      ? `a program that has since stopped (pid ${pid})`
      : KNOWN[name] === undefined
        ? `${name} (pid ${pid})`
        : `${KNOWN[name]} (${name}, pid ${pid})`,
  );
  return `held by ${who.join(' and ')}${held.open > 0 ? `, ${many(held.open)} of its ${everything} open` : ''}`;
}
