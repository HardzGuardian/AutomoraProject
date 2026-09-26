// Tables owned by the client, contract and SLA modules may only be read from
// src/modules/integrations. These are plain text scans, so they need no database.
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..');
const SRC_ROOT = path.join(REPO_ROOT, 'src');
const INTEGRATIONS_ROOT = path.join(SRC_ROOT, 'modules', 'integrations');

const EXTERNAL_TABLE_HANDLES = [
  'prisma.client',
  'prisma.contract',
  'prisma.contractAsset',
  'prisma.contractDocument',
  'prisma.contractSla',
  'prisma.asset',
  'prisma.assetSite',
  'prisma.serviceType',
  'prisma.renewal',
  'prisma.renewalFollowUp',
  'prisma.reminderLog',
  'prisma.ticket',
  'prisma.ticketMessage',
  'prisma.visit',
  'prisma.schedule',
  'prisma.slaBreach',
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && full.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function isInsideIntegrations(file: string): boolean {
  const relative = path.relative(REPO_ROOT, file);
  return relative.startsWith(path.join('src', 'modules', 'integrations'));
}

const allSourceFiles = walk(SRC_ROOT).filter((file) => !file.endsWith('.d.ts'));

describe('architecture: module boundaries', () => {
  it('finds source files to scan', () => {
    expect(allSourceFiles.length).toBeGreaterThan(0);
  });

  it('never queries client, contract or SLA tables outside the integration ports', () => {
    const violations: string[] = [];

    for (const file of allSourceFiles) {
      if (isInsideIntegrations(file)) continue;
      if (file.endsWith('.test.ts')) continue;

      const source = stripComments(fs.readFileSync(file, 'utf8'));
      for (const handle of EXTERNAL_TABLE_HANDLES) {
        if (source.includes(handle)) {
          violations.push(
            `${path.relative(REPO_ROOT, file)} references ${handle}`
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps the client and contract adapters inside src/modules/integrations', () => {
    const portFiles = walk(INTEGRATIONS_ROOT).filter(
      (file) => !file.endsWith('.test.ts')
    );

    expect(
      portFiles.some((file) => file.endsWith(path.join('client', 'client.port.ts')))
    ).toBe(true);
    expect(
      portFiles.some((file) => file.endsWith(path.join('contract', 'contract.port.ts')))
    ).toBe(true);
  });

  it('does not copy contract or SLA jobs into this module', () => {
    const jobsRoot = path.join(SRC_ROOT, 'jobs');
    const jobFiles = fs
      .readdirSync(jobsRoot)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'));

    // These jobs belong to the contract and SLA modules and must not be copied here.
    expect(jobFiles).not.toContain('contractStatus.job.ts');
    expect(jobFiles).not.toContain('renewalReminder.job.ts');
    expect(jobFiles).not.toContain('slaMonitor.job.ts');

    expect(jobFiles.sort()).toEqual([
      'index.ts',
      'overdueInvoice.job.ts',
      'scheduler.ts',
    ]);
  });

  it('does not duplicate the client/contract schema migration', () => {
    const migrationsRoot = path.join(REPO_ROOT, 'prisma', 'migrations');
    const folders = fs
      .readdirSync(migrationsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    expect(folders).not.toContain('20260922000000_person2_models');
    expect(folders).toContain('20260924000000_person4_finance');
  });

  it('keeps the SLA adapter under integrations', () => {
    const adapter = path.join(
      INTEGRATIONS_ROOT,
      'sla',
      'slaNotification.adapter.ts'
    );
    expect(fs.existsSync(adapter)).toBe(true);
  });
});

function readPrismaSchema(): string {
  const prismaRoot = path.join(REPO_ROOT, 'prisma');
  const files: string[] = [];
  const collect = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'migrations') collect(full);
      else if (entry.isFile() && entry.name.endsWith('.prisma')) files.push(full);
    }
  };
  collect(prismaRoot);
  return files.map((file) => stripComments(fs.readFileSync(file, 'utf8'))).join('\n');
}

describe('architecture: no ticket or visit models are defined here', () => {
  it('defines no ticket, visit or SLA models', () => {
    const schema = readPrismaSchema();
    for (const model of [
      'Ticket',
      'TicketMessage',
      'Visit',
      'VisitPhoto',
      'Schedule',
      'SlaBreach',
      'Assignment',
    ]) {
      expect(schema).not.toMatch(new RegExp(`^model ${model}\\b`, 'm'));
    }
  });

  it('defines the four finance models exactly once', () => {
    const schema = readPrismaSchema();
    for (const model of ['Invoice', 'InvoiceItem', 'Payment', 'NotificationLog']) {
      const matches = schema.match(new RegExp(`^model ${model}\\b`, 'gm')) ?? [];
      expect(matches).toHaveLength(1);
    }
  });

  it('defines the six finance enums exactly once', () => {
    const schema = readPrismaSchema();
    for (const enumeration of [
      'InvoiceSourceType',
      'InvoiceStatus',
      'PaymentMethod',
      'PaymentStatus',
      'NotificationChannel',
      'NotificationStatus',
    ]) {
      const matches =
        schema.match(new RegExp(`^enum ${enumeration}\\b`, 'gm')) ?? [];
      expect(matches).toHaveLength(1);
    }
  });

  it('keeps the notification de-duplication unique constraint', () => {
    const schema = readPrismaSchema();
    expect(schema).toContain('@@unique([eventKey, channel, recipient])');
  });
});
