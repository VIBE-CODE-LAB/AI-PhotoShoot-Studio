import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const port = Number(process.env.PORT || process.env.BILLING_PORT || 8787);
const dataPath = join(dirname(fileURLToPath(import.meta.url)), 'data', 'billing.json');
const distPath = join(dirname(fileURLToPath(import.meta.url)), 'dist');
const exchangeRate = 87.5;
const markupMultiplier = 1.25;

const calculateBilling = (model, usage) => {
	if (!model || !usage || ![usage.prompt_token_count, usage.candidates_token_count, usage.total_token_count].every((count) => Number.isInteger(count) && count > 0)) {
		throw new Error('Missing vital token metadata');
	}
	const isFlash = /gemini-(?:2\.5|1\.5|3(?:\.1)?)-flash/i.test(model);
	const isPro = /gemini-(?:2\.5|1\.5|3(?:\.1)?)-pro/i.test(model);
	if (!isFlash && !isPro) throw new Error('Unsupported Gemini billing model');
	const inputRate = isFlash ? 0.075 : 1.25;
	const outputRate = isFlash ? 0.3 : 5;
	const calculatedUsd = usage.prompt_token_count * inputRate / 1_000_000
		+ usage.candidates_token_count * outputRate / 1_000_000;
	const calculatedBaseInr = calculatedUsd * exchangeRate;
	return {
		status: 'success',
		calculation_breakdown: {
			model,
			raw_input_tokens: usage.prompt_token_count,
			raw_output_tokens: usage.candidates_token_count,
			calculated_usd_cost: Number(calculatedUsd.toFixed(6)),
			calculated_base_inr_cost: Number(calculatedBaseInr.toFixed(4)),
		},
		final_user_billing_inr: Number((calculatedBaseInr * markupMultiplier).toFixed(2)),
	};
};

const loadLedger = () => {
	if (!existsSync(dataPath)) return {};
	try {
		return JSON.parse(readFileSync(dataPath, 'utf8'));
	} catch {
		return {};
	}
};

const saveLedger = (ledger) => {
	mkdirSync(dirname(dataPath), { recursive: true });
	writeFileSync(dataPath, JSON.stringify(ledger, null, 2));
};

const json = (response, status, body) => {
	response.writeHead(status, {
		'Content-Type': 'application/json',
		'Access-Control-Allow-Origin': process.env.BILLING_ALLOWED_ORIGIN || '*',
	});
	response.end(JSON.stringify(body));
};

const readBody = (request) => new Promise((resolve, reject) => {
	let body = '';
	request.on('data', (chunk) => {
		body += chunk;
		if (body.length > 10000) reject(new Error('Request too large.'));
	});
	request.on('end', () => {
		try {
			resolve(JSON.parse(body || '{}'));
		} catch {
			reject(new Error('Invalid JSON.'));
		}
	});
	request.on('error', reject);
});

const validateIdentity = (body) => {
	if (typeof body.keyFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(body.keyFingerprint)) {
		throw new Error('Invalid API key fingerprint.');
	}
	if (typeof body.userName !== 'string' || !body.userName.trim() || body.userName.trim().length > 100) {
		throw new Error('A valid user name is required.');
	}
	return { keyFingerprint: body.keyFingerprint, userName: body.userName.trim() };
};

const toSummary = (account, currentUserName) => {
	const users = account.records.reduce((totals, record) => {
		const userName = record.userName || 'Previous records';
		const current = totals.get(userName) || { userName, totalUsd: 0, totalInr: 0 };
		current.totalUsd += record.costUsd;
		current.totalInr += record.finalUserBillingInr ?? record.costInr;
		totals.set(userName, current);
		return totals;
	}, new Map());
	if (!users.has(currentUserName)) users.set(currentUserName, { userName: currentUserName, totalUsd: 0, totalInr: 0 });

	return {
		userName: currentUserName,
		totalUsd: Number(account.totalUsd.toFixed(6)),
		totalInr: Number(account.totalInr.toFixed(2)),
		users: Array.from(users.values()).map((user) => ({
			...user,
			totalUsd: Number(user.totalUsd.toFixed(6)),
			totalInr: Number(user.totalInr.toFixed(2)),
		})),
		records: account.records.slice(-100).reverse(),
	};
};

const billingRoutes = ['/api/billing/summary', '/api/billing/record', '/billing/summary', '/billing/record'];
const contentTypes = {
	'.css': 'text/css',
	'.js': 'application/javascript',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.svg': 'image/svg+xml',
	'.webp': 'image/webp',
};

const server = createServer(async (request, response) => {
	if (request.method === 'OPTIONS') {
		response.writeHead(204, {
			'Access-Control-Allow-Origin': process.env.BILLING_ALLOWED_ORIGIN || '*',
			'Access-Control-Allow-Headers': 'Content-Type',
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
		});
		response.end();
		return;
	}
	if (request.method === 'GET' && existsSync(distPath)) {
		const requestedPath = decodeURIComponent((request.url || '/').split('?')[0]);
		const relativePath = requestedPath === '/' ? '/index.html' : requestedPath;
		const filePath = join(distPath, relativePath);
		if (filePath.startsWith(distPath) && existsSync(filePath)) {
			const extension = filePath.slice(filePath.lastIndexOf('.'));
			response.writeHead(200, { 'Content-Type': contentTypes[extension] || 'text/html' });
			response.end(readFileSync(filePath));
			return;
		}
	}

	if (request.method !== 'POST' || !billingRoutes.includes(request.url)) {
		json(response, 404, { error: 'Not found.' });
		return;
	}

	try {
		const body = await readBody(request);
		const { keyFingerprint, userName } = validateIdentity(body);
		const ledger = loadLedger();
		const account = ledger[keyFingerprint] || { userName, totalUsd: 0, totalInr: 0, records: [] };
		account.userName = userName;

		if (request.url.endsWith('/billing/record')) {
			const calculation = calculateBilling(body.model_used, body.usage_metadata);
			const costUsd = calculation.calculation_breakdown.calculated_usd_cost;
			const baseInr = calculation.calculation_breakdown.calculated_base_inr_cost;
			account.totalUsd += costUsd;
			account.totalInr += calculation.final_user_billing_inr;
			account.records.push({
				id: randomUUID(),
				createdAt: new Date().toISOString(),
				userName,
				model: body.model,
				quality: body.quality,
				rawInputTokens: body.usage_metadata.prompt_token_count,
				rawOutputTokens: body.usage_metadata.candidates_token_count,
				costUsd,
				costInr: baseInr,
				finalUserBillingInr: calculation.final_user_billing_inr,
			});
			ledger[keyFingerprint] = account;
			saveLedger(ledger);
		}

		json(response, 200, toSummary(account, userName));
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Billing request failed.';
		if (message === 'Missing vital token metadata') {
			json(response, 400, { status: 'error', message });
			return;
		}
		json(response, 400, { error: message });
	}
});

server.listen(port, '0.0.0.0', () => {
	console.log(`Billing service listening on http://0.0.0.0:${port}`);
});
