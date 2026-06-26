import { IpcChannels } from '@shared/ipc/channels';
import type { AppContainer } from '@main/container';
import { handle } from '../registry';

export function registerTemplateHandlers(container: AppContainer): void {
  const { templates } = container;

  handle(IpcChannels.TemplateList, () => templates.list());
  handle(IpcChannels.TemplateUpsert, (template) => templates.upsert(template));
}
