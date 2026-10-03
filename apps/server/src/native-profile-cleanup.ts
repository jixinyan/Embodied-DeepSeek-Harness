import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';

const nonblank = z.string().trim().min(1);
const absolute = nonblank.refine(isAbsolute, 'Native profile cleanup requires absolute paths.');
export const nativeProfileCleanupSchema = z
  .object({
    command: z.tuple([absolute]).rest(nonblank),
    cwd: absolute,
    env: z.record(z.string(), z.string()),
    recordDirectory: absolute,
    timeoutMs: z.number().int().min(1).max(300_000).optional(),
  })
  .strict();

export type NativeProfileCleanupConfiguration = z.infer<typeof nativeProfileCleanupSchema>;

const receiptSchema = z
  .object({
    commname: z.string().regex(/^edh-[0-9a-f]{11}$/),
    pid: z.number().int().positive(),
    process_create_time: z.number().finite().positive(),
    owner_pid: z.number().int().positive(),
    owner_create_time: z.number().finite().positive(),
    profile_sha256: z.string().regex(/^[0-9a-f]{64}$/),
    native_process_absent: z.literal(true),
    owner_process_absent: z.literal(true),
    owned_group_absent: z.literal(true),
    profile_removed: z.literal(true),
  })
  .strict();

export class NativeProfileCleanup {
  readonly ownerToken = randomUUID().replaceAll('-', '');
  readonly configuration: NativeProfileCleanupConfiguration;
  private preparing: Promise<void> | undefined;
  private prepared = false;
  private releasing: Promise<void> | undefined;

  constructor(configuration: NativeProfileCleanupConfiguration) {
    this.configuration = nativeProfileCleanupSchema.parse(configuration);
  }

  get workerEnvironment(): Readonly<Record<string, string>> {
    if (!this.prepared) throw new Error('Native NVIDIA profile cleanup binding was not admitted.');
    return {
      EDH_NVIDIA_EGL_PROFILE: '1',
      EDH_NVIDIA_PROFILE_RECORD_DIR: this.configuration.recordDirectory,
      EDH_NVIDIA_PROFILE_OWNER_TOKEN: this.ownerToken,
    };
  }

  prepare(): Promise<void> {
    return (this.preparing ??= this.prepareOwned());
  }

  release(): Promise<void> {
    return (this.releasing ??= this.releaseOwned());
  }

  private async execute(mode: '--validate-owner-root' | '--release-owner'): Promise<string> {
    const { command, cwd, env, recordDirectory, timeoutMs } = this.configuration;
    const result = await promisify(execFile)(
      command[0],
      [
        ...command.slice(1),
        mode,
        '--record-root',
        recordDirectory,
        '--owner-token',
        this.ownerToken,
      ],
      {
        cwd,
        env: { ...process.env, ...env },
        timeout: timeoutMs ?? 30_000,
        killSignal: 'SIGKILL',
        maxBuffer: 4 * 1024 * 1024,
      },
    );
    return result.stdout;
  }

  private async prepareOwned(): Promise<void> {
    z.object({
      owner_token: z.literal(this.ownerToken),
      record_root: z.literal(this.configuration.recordDirectory),
      record_root_writable: z.literal(true),
    })
      .strict()
      .parse(JSON.parse(await this.execute('--validate-owner-root')));
    this.prepared = true;
  }

  private async releaseOwned(): Promise<void> {
    if (!this.prepared) throw new Error('Native NVIDIA profile release has no admitted binding.');
    const receipt = z
      .object({
        owner_token: z.literal(this.ownerToken),
        record_root: z.literal(this.configuration.recordDirectory),
        profiles: z.array(receiptSchema).max(1024),
      })
      .strict()
      .parse(JSON.parse(await this.execute('--release-owner')));
    if (
      new Set(receipt.profiles.map((profile) => profile.commname)).size !== receipt.profiles.length
    )
      throw new Error('Native profile cleanup repeated an owned profile identity.');
    process.stderr.write(`Native profile cleanup: ${JSON.stringify(receipt)}\n`);
  }
}
