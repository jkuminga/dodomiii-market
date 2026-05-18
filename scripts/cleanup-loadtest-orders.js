#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printUsage();
  process.exit(0);
}

loadEnvFile(path.join(BACKEND_DIR, '.env'));

const prismaClientPath = require.resolve('@prisma/client', {
  paths: [BACKEND_DIR, ROOT_DIR],
});
const { PrismaClient } = require(prismaClientPath);
const prisma = new PrismaClient();

const prefix = args.prefix || 'LOADTEST';
const execute = Boolean(args.yes);
const limit = Number(args.limit || 500);
const createdBefore = args['created-before'] ? new Date(args['created-before']) : null;
const createdAfter = args['created-after'] ? new Date(args['created-after']) : null;

if (prefix.length < 6 && !args['allow-short-prefix']) {
  exitWithError('Refusing to use a prefix shorter than 6 chars. Pass --allow-short-prefix to override.');
}

if (!Number.isInteger(limit) || limit < 1 || limit > 5000) {
  exitWithError('--limit must be an integer between 1 and 5000.');
}

if (createdBefore && Number.isNaN(createdBefore.getTime())) {
  exitWithError('--created-before must be a valid date string.');
}

if (createdAfter && Number.isNaN(createdAfter.getTime())) {
  exitWithError('--created-after must be a valid date string.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

async function main() {
  const where = buildWhere();
  const orders = await prisma.order.findMany({
    where,
    select: {
      id: true,
      orderNumber: true,
      orderStatus: true,
      customerRequest: true,
      createdAt: true,
      contact: {
        select: {
          buyerName: true,
          buyerPhone: true,
          receiverName: true,
        },
      },
      _count: {
        select: {
          items: true,
          statusHistories: true,
        },
      },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit,
  });

  const printableOrders = orders.map((order) => ({
    id: order.id.toString(),
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
    createdAt: order.createdAt.toISOString(),
    buyerName: order.contact?.buyerName || null,
    buyerPhone: order.contact?.buyerPhone || null,
    receiverName: order.contact?.receiverName || null,
    itemCount: order._count.items,
    statusHistoryCount: order._count.statusHistories,
    customerRequest: order.customerRequest,
  }));

  console.log(JSON.stringify({ mode: execute ? 'delete' : 'dry-run', prefix, count: orders.length, orders: printableOrders }, null, 2));

  if (!execute) {
    console.log('Dry run only. Re-run with --yes to delete these orders.');
    return;
  }

  if (orders.length === 0) {
    console.log('No matching loadtest orders found.');
    return;
  }

  const orderIds = orders.map((order) => order.id);
  const result = await prisma.order.deleteMany({
    where: {
      id: {
        in: orderIds,
      },
    },
  });

  console.log(`Deleted ${result.count} loadtest orders.`);
}

function buildWhere() {
  const createdAt = {};

  if (createdBefore) {
    createdAt.lt = createdBefore;
  }

  if (createdAfter) {
    createdAt.gte = createdAfter;
  }

  return {
    ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
    OR: [
      {
        customerRequest: {
          startsWith: `[${prefix}]`,
        },
      },
      {
        contact: {
          is: {
            buyerName: {
              startsWith: `${prefix}_`,
            },
          },
        },
      },
      {
        contact: {
          is: {
            receiverName: {
              startsWith: `${prefix}_`,
            },
          },
        },
      },
    ],
  };
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith('--')) {
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split('=', 2);
    if (inlineValue !== undefined) {
      parsed[rawKey] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      parsed[rawKey] = true;
      continue;
    }

    parsed[rawKey] = next;
    index += 1;
  }

  return parsed;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = unquoteEnvValue(trimmed.slice(separatorIndex + 1).trim());

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function unquoteEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function exitWithError(message) {
  console.error(message);
  process.exit(1);
}

function printUsage() {
  console.log(`Usage:
  node scripts/cleanup-loadtest-orders.js [options]

Options:
  --yes                         Delete matching orders. Without this, dry-run only.
  --prefix LOADTEST             Match order markers. Default: LOADTEST.
  --limit 500                   Max orders to inspect/delete. Default: 500.
  --created-after 2026-05-02    Only include orders created at or after this date.
  --created-before 2026-05-03   Only include orders created before this date.
  --help                        Show this message.

Matching rules:
  customerRequest starts with "[<prefix>]"
  OR buyerName starts with "<prefix>_"
  OR receiverName starts with "<prefix>_"
`);
}
