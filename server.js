import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const port = Number(process.env.PORT || process.env.BILLING_PORT || 8787);
const dataPath = join(dirname(fileURLToPath(import.meta.url)), 'data', 'billing.json');
const distPath = join(dirname(fileURLToPath(import.meta.url)), 'dist');
const exchangeRate = Number(process.env.BILLING_USD_TO_INR || 85);

// Override these values when Google changes pricing. Amounts are USD per image.
const rates = {
	'gemini-3-pro-image-preview': {
		'1K': Number(process.env.GEMINI_3_PRO_IMAGE_1K_USD || 0.134),
		'2K': Number(process.env.GEMINI_3_PRO_IMAGE_2K_USD || 0.134),
	},
	'gemini-3.1-flash-image-preview': {
		'1K': Number(process.env.GEMINI_31_FLASH_IMAGE_1K_USD || 0.039),
		'2K': Number(process.env.GEMINI_31_FLASH_IMAGE_2K_USD || 0.039),
	},
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
		current.totalInr += record.costInr;
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
			if (!Object.hasOwn(rates, body.model) || !Object.hasOwn(rates[body.model], body.quality)) {
				throw new Error('Unsupported model or quality.');
			}
			const costUsd = rates[body.model][body.quality];
			const costInr = costUsd * exchangeRate;
			account.totalUsd += costUsd;
			account.totalInr += costInr;
			account.records.push({
				id: randomUUID(),
				createdAt: new Date().toISOString(),
				userName,
				model: body.model,
				quality: body.quality,
				costUsd,
				costInr: Number(costInr.toFixed(2)),
			});
			ledger[keyFingerprint] = account;
			saveLedger(ledger);
		}

		json(response, 200, toSummary(account, userName));
	} catch (error) {
		json(response, 400, { error: error instanceof Error ? error.message : 'Billing request failed.' });
	}
});

server.listen(port, '0.0.0.0', () => {
	console.log(`Billing service listening on http://0.0.0.0:${port}`);
});
