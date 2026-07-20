import path from 'node:path';
import react from '@vitejs/plugin-react';
import { createLogger, defineConfig } from 'vite';
import { componentTagger } from 'lovable-tagger';
import inlineEditPlugin from './plugins/visual-editor/vite-plugin-react-inline-editor.js';
import editModeDevPlugin from './plugins/visual-editor/vite-plugin-edit-mode.js';
import iframeRouteRestorationPlugin from './plugins/vite-plugin-iframe-route-restoration.js';

const isDev = process.env.NODE_ENV !== 'production';

const configHorizonsViteErrorHandler = `
const observer = new MutationObserver((mutations) => {
	for (const mutation of mutations) {
		for (const addedNode of mutation.addedNodes) {
			if (
				addedNode.nodeType === Node.ELEMENT_NODE &&
				(
					addedNode.tagName?.toLowerCase() === 'vite-error-overlay' ||
					addedNode.classList?.contains('backdrop')
				)
			) {
				handleViteOverlay(addedNode);
			}
		}
	}
});

observer.observe(document.documentElement, {
	childList: true,
	subtree: true
});

function handleViteOverlay(node) {
	if (!node.shadowRoot) {
		return;
	}

	const backdrop = node.shadowRoot.querySelector('.backdrop');

	if (backdrop) {
		const overlayHtml = backdrop.outerHTML;
		const parser = new DOMParser();
		const doc = parser.parseFromString(overlayHtml, 'text/html');
		const messageBodyElement = doc.querySelector('.message-body');
		const fileElement = doc.querySelector('.file');
		const messageText = messageBodyElement ? messageBodyElement.textContent.trim() : '';
		const fileText = fileElement ? fileElement.textContent.trim() : '';
		const error = messageText + (fileText ? ' File:' + fileText : '');

		window.parent.postMessage({
			type: 'horizons-vite-error',
			error,
		}, '*');
	}
}
`;

const configHorizonsRuntimeErrorHandler = `
window.onerror = (message, source, lineno, colno, errorObj) => {
	const errorDetails = errorObj ? JSON.stringify({
		name: errorObj.name,
		message: errorObj.message,
		stack: errorObj.stack,
		source,
		lineno,
		colno,
	}) : null;

	window.parent.postMessage({
		type: 'horizons-runtime-error',
		message,
		error: errorDetails
	}, '*');
};
`;

const configHorizonsConsoleErrroHandler = `
const originalConsoleError = console.error;
console.error = function(...args) {
	originalConsoleError.apply(console, args);

	let errorString = '';

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg instanceof Error) {
			errorString = arg.stack || \`\${arg.name}: \${arg.message}\`;
			break;
		}
	}

	if (!errorString) {
		errorString = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
	}

	window.parent.postMessage({
		type: 'horizons-console-error',
		error: errorString
	}, '*');
};
`;

const configWindowFetchMonkeyPatch = `
const originalFetch = window.fetch;

window.fetch = function(...args) {
	const url = args[0] instanceof Request ? args[0].url : args[0];

	// Skip WebSocket URLs
	if (url.startsWith('ws:') || url.startsWith('wss:')) {
		return originalFetch.apply(this, args);
	}

	return originalFetch.apply(this, args)
		.then(async response => {
			const contentType = response.headers.get('Content-Type') || '';

			// Exclude HTML document responses
			const isDocumentResponse =
				contentType.includes('text/html') ||
				contentType.includes('application/xhtml+xml');

			if (!response.ok && !isDocumentResponse) {
					const responseClone = response.clone();
					const errorFromRes = await responseClone.text();
					const requestUrl = response.url;
					console.error(\`Fetch error from \${requestUrl}: \${errorFromRes}\`);
			}

			return response;
		})
		.catch(error => {
			if (!url.match(/\.html?$/i)) {
				console.error(error);
			}

			throw error;
		});
};
`;

const configNavigationHandler = `
if (window.navigation && window.self !== window.top) {
	window.navigation.addEventListener('navigate', (event) => {
		const url = event.destination.url;

		try {
			const destinationUrl = new URL(url);
			const destinationOrigin = destinationUrl.origin;
			const currentOrigin = window.location.origin;

			if (destinationOrigin === currentOrigin) {
				return;
			}
		} catch (error) {
			return;
		}

		window.parent.postMessage({
			type: 'horizons-navigation-error',
			url,
		}, '*');
	});
}
`;

const addTransformIndexHtml = {
	name: 'add-transform-index-html',
	transformIndexHtml(html) {
		const tags = [
			{
				tag: 'script',
				attrs: { type: 'module' },
				children: configHorizonsRuntimeErrorHandler,
				injectTo: 'head',
			},
			{
				tag: 'script',
				attrs: { type: 'module' },
				children: configHorizonsViteErrorHandler,
				injectTo: 'head',
			},
			{
				tag: 'script',
				attrs: {type: 'module'},
				children: configHorizonsConsoleErrroHandler,
				injectTo: 'head',
			},
			{
				tag: 'script',
				attrs: { type: 'module' },
				children: configWindowFetchMonkeyPatch,
				injectTo: 'head',
			},
			{
				tag: 'script',
				attrs: { type: 'module' },
				children: configNavigationHandler,
				injectTo: 'head',
			},
		];

		if (!isDev && process.env.TEMPLATE_BANNER_SCRIPT_URL && process.env.TEMPLATE_REDIRECT_URL) {
			tags.push(
				{
					tag: 'script',
					attrs: {
						src: process.env.TEMPLATE_BANNER_SCRIPT_URL,
						'template-redirect-url': process.env.TEMPLATE_REDIRECT_URL,
					},
					injectTo: 'head',
				}
			);
		}

		return {
			html,
			tags,
		};
	},
};

console.warn = () => {};

const logger = createLogger()
const loggerError = logger.error

logger.error = (msg, options) => {
	if (options?.error?.toString().includes('CssSyntaxError: [postcss]')) {
		return;
	}

	loggerError(msg, options);
}

export default defineConfig(({ mode }) => ({
	customLogger: logger,
	plugins: [
		...(isDev ? [inlineEditPlugin(), editModeDevPlugin(), iframeRouteRestorationPlugin()] : []),
		react(),
		mode === 'development' && componentTagger(),
		addTransformIndexHtml
	].filter(Boolean),
	server: {
		host: "::",
		port: 8080,
		cors: true,
		headers: {
			'X-Frame-Options': 'SAMEORIGIN',
		},
		allowedHosts: true,
	},
	resolve: {
		extensions: ['.jsx', '.js', '.tsx', '.ts', '.json', ],
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
	build: {
		rollupOptions: {
			external: [
				'@babel/parser',
				'@babel/traverse',
				'@babel/generator',
				'@babel/types'
			],
			output: {
				// Put the libraries that every page needs, and that almost never
				// change, into their own chunks. Their filenames then stay stable
				// across deploys, so a returning visitor re-downloads only the app
				// code we actually changed instead of the whole bundle.
				//
				// Deliberately NOT a catch-all for node_modules: heavy, rarely-used
				// libraries (jspdf, xlsx, pdfjs, recharts) must stay in the lazy
				// route chunks Rollup already creates for them. Forcing those into a
				// shared vendor chunk would load them on every page.
				manualChunks(id) {
					const p = id.replace(/\\/g, '/');
					if (!p.includes('node_modules')) return;
					if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(p)) {
						return 'vendor-react';
					}
					if (p.includes('node_modules/@supabase/')) return 'vendor-supabase';
					if (p.includes('node_modules/@radix-ui/')) return 'vendor-radix';
				},
			},
		}
	}
}));
