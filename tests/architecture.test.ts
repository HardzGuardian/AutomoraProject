/**
 * Layering / architecture guard.
 *
 * Person 4 may read Person 2 and Person 3 owned tables from exactly one place:
 * the integration adapters under src/modules/integrations/**. Anywhere else —
 * a service, a controller, a job — a direct table handle is a Rule 1
 * violation, because it couples Person 4 to another person's schema.
 *
 * These tests are intentionally simple text scans: they are cheap, they fail
 * loudly at review time, and they do not need a database.
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..');
const SRC_ROOT = path.join(REPO_ROOT, 'src');
const INTEGRATIONS_ROOT = path.join(SRC_ROOT, 'modules', 'integrations');

const PERSON_2_AND_3_HANDLES = [
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

describe('architecture: Person 4 layering', () => {
  it('finds source files to scan', () => {
    expect(allSourceFiles.length).toBeGreaterThan(0);
  });

  it('never queries a Person 2 or Person 3 table outside the integration ports', () => {
    const violations: string[] = [];

    for (const file of allSourceFiles) {
      if (isInsideIntegrations(file)) continue;
      if (file.endsWith('.test.ts')) continue;

      const source = stripComments(fs.readFileSync(file, 'utf8'));
      for (const handle of PERSON_2_AND_3_HANDLES) {
        if (source.includes(handle)) {
          violations.push(
            `${path.relative(REPO_ROOT, file)} references ${handle}`
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps the sanctioned Person 2 adapters inside src/modules/integrations', () => {
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

  it('does not fork Person 2 jobs on the Person 4 branch', () => {
    const jobsRoot = path.join(SRC_ROOT, 'jobs');
    const jobFiles = fs
      .readdirSync(jobsRoot)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'));

    // Person 2 owns contractStatus.job.ts and renewalReminder.job.ts.
    // Person 3 owns slaMonitor.job.ts. None may be copied here.
    expect(jobFiles).not.toContain('contractStatus.job.ts');
    expect(jobFiles).not.toContain('renewalReminder.job.ts');
    expect(jobFiles).not.toContain('slaMonitor.job.ts');

    // Person 4 owns exactly these job modules.
    expect(jobFiles.sort()).toEqual([
      'index.ts',
      'overdueInvoice.job.ts',
      'scheduler.ts',
    ]);
  });

  it('does not duplicate the Person 2 schema migration', () => {
    const migrationsRoot = path.join(REPO_ROOT, 'prisma', 'migrations');
    const folders = fs
      .readdirSync(migrationsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    // The Person 2 models are created by Person 2's own migration folder.
    expect(folders).not.toContain('20260922000000_person2_models');
    expect(folders).toContain('20260924000000_person4_finance');
  });

  it('keeps the SLA adapter on the Person 4 side', () => {
    const adapter = path.join(
      INTEGRATIONS_ROOT,
      'sla',
      'slaNotification.adapter.ts'
    );
    expect(fs.existsSync(adapter)).toBe(true);
  });
});

describe('architecture: Person 3 persistence is never invented', () => {
  const schemaPath = path.join(REPO_ROOT, 'prisma', 'schema.prisma');

  it('defines no Person 3 models', () => {
    const schema = stripComments(fs.readFileSync(schemaPath, 'utf8'));
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

  it('defines the four Person 4 models exactly once', () => {
    const schema = stripComments(fs.readFileSync(schemaPath, 'utf8'));
    for (const model of ['Invoice', 'InvoiceItem', 'Payment', 'NotificationLog']) {
      const matches = schema.match(new RegExp(`^model ${model}\\b`, 'gm')) ?? [];
      expect(matches).toHaveLength(1);
    }
  });

  it('defines the six Person 4 enums exactly once', () => {
    const schema = stripComments(fs.readFileSync(schemaPath, 'utf8'));
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
    const schema = stripComments(fs.readFileSync(schemaPath, 'utf8'));
    expect(schema).toContain('@@unique([eventKey, channel, recipient])');
  });
});
