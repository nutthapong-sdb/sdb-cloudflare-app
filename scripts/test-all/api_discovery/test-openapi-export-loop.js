const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { getApiToken, colors, log } = require('../libs/api-helper');

const API_BASE_URL = process.env.SCRAPE_API_URL || 'http://localhost:8002/api/scrape';
const DEFAULT_ACCOUNT_NAME = 'Siam Cement Public Company Limited (SCG)';
const DEFAULT_ZONE_NAME = 'scg.com';
const DEFAULT_HOSTNAME = 'scg.com';

function parseArgs(argv) {
  const out = {
    accountName: DEFAULT_ACCOUNT_NAME,
    zoneName: DEFAULT_ZONE_NAME,
    hostname: DEFAULT_HOSTNAME,
    includeLearnedParameters: true,
    includeRecommendedThresholds: false,
    maxAttempts: 15,
    intervalMs: 2000,
    outputFile: '',
  };

  argv.forEach((arg) => {
    if (arg.startsWith('--account=')) out.accountName = arg.slice('--account='.length);
    else if (arg.startsWith('--zone=')) out.zoneName = arg.slice('--zone='.length);
    else if (arg.startsWith('--host=')) out.hostname = arg.slice('--host='.length);
    else if (arg.startsWith('--learned=')) out.includeLearnedParameters = arg.slice('--learned='.length) !== 'false';
    else if (arg.startsWith('--thresholds=')) out.includeRecommendedThresholds = arg.slice('--thresholds='.length) === 'true';
    else if (arg.startsWith('--max=')) out.maxAttempts = Number(arg.slice('--max='.length)) || out.maxAttempts;
    else if (arg.startsWith('--interval=')) out.intervalMs = Number(arg.slice('--interval='.length)) || out.intervalMs;
    else if (arg.startsWith('--out=')) out.outputFile = arg.slice('--out='.length);
  });

  return out;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hostFromSchema(schema) {
  const title = schema?.info?.title;
  if (typeof title === 'string' && title.startsWith('Schema for ')) return title.replace('Schema for ', '').trim();
  if (typeof title === 'string' && title.startsWith('Cloudflare Learned Schema for ')) return title.replace('Cloudflare Learned Schema for ', '').trim();
  const serverUrl = schema?.servers?.[0]?.url;
  if (typeof serverUrl === 'string') {
    try {
      return new URL(serverUrl).hostname;
    } catch (_) {
      return '';
    }
  }
  return '';
}

function validateOpenApiSchema(doc, expectedHost) {
  const errors = [];

  if (!doc || typeof doc !== 'object') errors.push('Document is not a JSON object');
  if (doc?.openapi !== '3.0.0') errors.push(`openapi must be 3.0.0 (got: ${doc?.openapi || 'missing'})`);
  if (!doc?.info || typeof doc.info !== 'object') errors.push('info is missing');
  if (!doc?.info?.title || typeof doc.info.title !== 'string') errors.push('info.title is missing');
  if (!doc?.info?.version || typeof doc.info.version !== 'string') errors.push('info.version is missing');
  if (!doc?.paths || typeof doc.paths !== 'object' || Array.isArray(doc.paths)) errors.push('paths must be an object');

  const pathCount = doc?.paths && typeof doc.paths === 'object' ? Object.keys(doc.paths).length : 0;
  if (pathCount === 0) errors.push('paths is empty');

  let operationCount = 0;
  let learnedFieldCount = 0;
  let parametersCount = 0;
  let operationsWithParameters = 0;

  if (doc?.paths && typeof doc.paths === 'object') {
    Object.values(doc.paths).forEach((pathItem) => {
      if (!pathItem || typeof pathItem !== 'object') return;
      Object.entries(pathItem).forEach(([method, operation]) => {
        const lower = method.toLowerCase();
        if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'].includes(lower)) return;
        if (!operation || typeof operation !== 'object') return;

        operationCount += 1;

        if (Object.prototype.hasOwnProperty.call(operation, 'x-cf-parameter-schemas')) {
          learnedFieldCount += 1;
        }

        if (Array.isArray(operation.parameters) && operation.parameters.length > 0) {
          operationsWithParameters += 1;
          parametersCount += operation.parameters.length;
        }
      });
    });
  }

  if (operationCount === 0) errors.push('no HTTP operations found under paths');
  if (learnedFieldCount === 0 && operationsWithParameters === 0) {
    errors.push('no learned parameter signal found (x-cf-parameter-schemas or operation.parameters)');
  }

  const serverUrl = doc?.servers?.[0]?.url;
  if (!serverUrl || typeof serverUrl !== 'string') {
    errors.push('servers[0].url is missing');
  } else {
    try {
      const hostname = new URL(serverUrl).hostname;
      if (hostname !== expectedHost) errors.push(`servers[0].url hostname mismatch (expected: ${expectedHost}, got: ${hostname})`);
    } catch (_) {
      errors.push(`servers[0].url is invalid URL (${serverUrl})`);
    }
  }

  const titleHost = hostFromSchema(doc);
  if (titleHost && titleHost !== expectedHost) {
    errors.push(`info.title hostname mismatch (expected: ${expectedHost}, got: ${titleHost})`);
  }

  return {
    ok: errors.length === 0,
    errors,
    pathCount,
    operationCount,
    learnedFieldCount,
    parametersCount,
    operationsWithParameters,
  };
}

async function callScrape(action, payload, apiToken) {
  const response = await axios.post(API_BASE_URL, { action, ...payload, apiToken }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
  });

  if (!response?.data?.success) {
    throw new Error(response?.data?.message || `Action failed: ${action}`);
  }

  return response.data;
}

async function resolveZoneId(apiToken, accountName, zoneName) {
  const accountRes = await callScrape('get-account-info', {}, apiToken);
  const accounts = Array.isArray(accountRes.data) ? accountRes.data : [];
  const account = accounts.find((a) => a.name === accountName);
  if (!account) {
    throw new Error(`Account not found: ${accountName}`);
  }

  const zonesRes = await callScrape('list-zones', { accountId: account.id }, apiToken);
  const zones = Array.isArray(zonesRes.data) ? zonesRes.data : [];
  const zone = zones.find((z) => z.name === zoneName);
  if (!zone) {
    throw new Error(`Zone not found in account ${accountName}: ${zoneName}`);
  }

  return { accountId: account.id, zoneId: zone.id };
}

async function fetchHostSchema(apiToken, zoneId, hostname, includeLearnedParameters, includeRecommendedThresholds) {
  const data = await callScrape('get-api-openapi-schemas', {
    zoneId,
    hostname,
    includeLearnedParameters,
    includeRecommendedThresholds,
  }, apiToken);

  const schemas = Array.isArray(data.data) ? data.data : [];
  const hostSchemas = schemas.filter((schema) => hostFromSchema(schema) === hostname);
  if (hostSchemas.length === 0) {
    return null;
  }

  return hostSchemas[0];
}

function resolveOutputFile(outputFile, hostname) {
  if (outputFile) return outputFile;
  const file = `openapi_${hostname.replace(/[^a-zA-Z0-9.-]/g, '_')}.json`;
  return path.join(process.cwd(), 'scripts', 'test-all', 'api_discovery', file);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiToken = getApiToken();

  log('🚀 OpenAPI export validation loop', colors.cyan);
  log(`API: ${API_BASE_URL}`, colors.blue);
  log(`Account: ${args.accountName}`, colors.blue);
  log(`Zone: ${args.zoneName}`, colors.blue);
  log(`Hostname: ${args.hostname}`, colors.blue);

  const { zoneId } = await resolveZoneId(apiToken, args.accountName, args.zoneName);
  log(`✅ Resolved zoneId: ${zoneId}`, colors.green);

  const outputFile = resolveOutputFile(args.outputFile, args.hostname);

  for (let attempt = 1; attempt <= args.maxAttempts; attempt += 1) {
    log(`\n[Attempt ${attempt}/${args.maxAttempts}] Export + validate`, colors.magenta);

    const schema = await fetchHostSchema(
      apiToken,
      zoneId,
      args.hostname,
      args.includeLearnedParameters,
      args.includeRecommendedThresholds
    );

    if (!schema) {
      log(`❌ No schema returned for hostname ${args.hostname}`, colors.red);
      if (attempt < args.maxAttempts) {
        await delay(args.intervalMs);
        continue;
      }
      throw new Error('Schema not found after max attempts');
    }

    fs.writeFileSync(outputFile, JSON.stringify(schema, null, 2), 'utf8');
    log(`📄 Saved: ${outputFile}`, colors.blue);

    const loaded = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    const validation = validateOpenApiSchema(loaded, args.hostname);

    if (validation.ok) {
      log(
        `✅ Valid OpenAPI JSON (paths: ${validation.pathCount}, operations: ${validation.operationCount}, learnedFields: ${validation.learnedFieldCount}, params: ${validation.parametersCount})`,
        colors.green
      );
      process.exit(0);
    }

    log('❌ Invalid structure:', colors.red);
    validation.errors.forEach((err) => log(`   - ${err}`, colors.red));

    if (attempt < args.maxAttempts) {
      log(`⏳ Retrying in ${args.intervalMs}ms...`, colors.yellow);
      await delay(args.intervalMs);
    }
  }

  throw new Error(`Validation failed after ${args.maxAttempts} attempts`);
}

main().catch((err) => {
  log(`\nFatal: ${err.message}`, colors.red);
  process.exit(1);
});
