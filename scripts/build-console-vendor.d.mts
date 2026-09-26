export function buildConsoleVendor(root: string): Promise<{
  bundle: string;
  legalNotices: string;
  manifest: string;
}>;
