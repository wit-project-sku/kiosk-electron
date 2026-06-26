import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { Result } from '@shared/types/result';
import { err, ok } from '@shared/types/result';
import type { InvokeChannel, RequestOf, ResponseOf } from '@shared/ipc/contracts';
import { AppError } from '@main/core/AppError';
import { createLogger } from '@main/core/logger';

const log = createLogger('ipc');

/** Extracts the success value `T` from a `Result<T>` response type. */
type ValueOf<C extends InvokeChannel> = ResponseOf<C> extends Result<infer T> ? T : never;

/**
 * A channel handler returns the *success value* (or throws an AppError). The
 * registry wraps the value in `ok()` and converts any thrown error into a
 * structured `err()` envelope — handlers never deal with the Result wrapper or
 * with try/catch boilerplate themselves.
 */
type ChannelHandler<C extends InvokeChannel> = (
  request: RequestOf<C>,
  event: IpcMainInvokeEvent,
) => Promise<ValueOf<C>> | ValueOf<C>;

/**
 * Register a typed invoke handler. The single try/catch here is the one place
 * main-process errors are normalized, logged, and serialized for the renderer.
 */
export function handle<C extends InvokeChannel>(channel: C, handler: ChannelHandler<C>): void {
  ipcMain.handle(channel, async (event, request: RequestOf<C>): Promise<ResponseOf<C>> => {
    try {
      const value = await handler(request, event);
      return ok(value) as ResponseOf<C>;
    } catch (error) {
      const serializable = AppError.toSerializable(error);
      // VALIDATION/NOT_FOUND are expected control flow; log them quietly.
      if (serializable.code === 'UNKNOWN' || serializable.code === 'DATABASE') {
        log.error(`IPC ${channel} failed`, error);
      } else {
        log.warn(`IPC ${channel} rejected`, { code: serializable.code });
      }
      return err(serializable) as ResponseOf<C>;
    }
  });
}
