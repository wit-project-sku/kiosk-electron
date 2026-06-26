import { CustomerDisplay } from '@renderer/features/display/CustomerDisplay';

/** Root for the customer display window. Intentionally minimal and chrome-free. */
export function DisplayApp(): JSX.Element {
  return <CustomerDisplay />;
}
