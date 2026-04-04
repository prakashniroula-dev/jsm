// magic-swc-loader.js – optimized version
(function() {
  const SWC_URL = 'https://unpkg.com/@swc/wasm-web@1.3.92/wasm-web.js';
  const baseURL = location.href.substring(0, location.href.lastIndexOf('/') + 1);

  const modules = new Map();
  const specifierToUrlMap = new Map();
  const resolveCache = new Map(); // Unified cache for both URL fetches and specifier resolution
  const importRegex = /import\s+[^'"]*['"]([^'"]+)['"]/g;
  const exportFromRegex = /export\s+(?:\*\s+as\s+\w+\s+from\s+['"]|\*\s+from\s+['"]|{[^}]*}\s+from\s+['"])([^'"]+)['"]/g;
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  let transform;
  let inlineCounter = 0;

  async function initSWC() {
    if (transform) return;
    const { default: init, transform: swcTransform } = await import(SWC_URL);
    await init();
    transform = swcTransform;
  }

  function findImports(source) {
    const imports = new Set();
    for (const regex of [importRegex, exportFromRegex, requireRegex]) {
      let match;
      while ((match = regex.exec(source))) imports.add(match[1]);
    }
    return Array.from(imports);
  }

  async function tryFetch(url) {
    if (resolveCache.has(url)) {
      return resolveCache.get(url);
    }
    try {
      const res = await fetch(url);
      if (res.status === 404) {
        resolveCache.set(url, null);
        return null;
      }
      if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
      const result = { url, source: await res.text() };
      resolveCache.set(url, result);
      return result;
    } catch (err) {
      if (err instanceof TypeError) {
        resolveCache.set(url, null);
        return null;
      }
      throw err;
    }
  }

  async function resolveModule(specifier, referrerUrl) {
    if (specifier.includes('://')) {
      const result = await tryFetch(specifier);
      if (!result) throw new Error(`External module ${specifier} not found`);
      return result;
    }

    const referrerDir = new URL('./', referrerUrl).href;
    const cacheKey = `${referrerDir}|${specifier}`;
    if (resolveCache.has(cacheKey)) {
      return resolveCache.get(cacheKey);
    }

    const [path, rest] = specifier.split(/([?#].*)/);
    const hasExplicitExtension = /\.(\w+)(?:[?#]|$)/.test(path);
    console.log(hasExplicitExtension, path, rest);
    const base = new URL(referrerUrl);
    const candidates = hasExplicitExtension 
      ? [specifier]
      : [`${path}.ts${rest || ''}`, `${path}.js${rest || ''}`];

    for (const cand of candidates) {
      const result = await tryFetch(new URL(cand, base).href);
      if (result) {
        resolveCache.set(cacheKey, result);
        return result;
      }
    }
    throw new Error(`Cannot resolve module ${specifier} from ${referrerUrl}`);
  }

  function getExtension(url) {
    return url.split('/').pop().split('?')[0].split('#')[0].split('.').pop();
  }

  async function loadModule(specifier, referrerUrl = baseURL) {
    const { url: finalUrl, source } = await resolveModule(specifier, referrerUrl);
    specifierToUrlMap.set(`${referrerUrl}|${specifier}`, finalUrl);

    const existing = modules.get(finalUrl);
    if (existing) return existing.state === 'loading' ? existing.promise : Promise.resolve(finalUrl);

    let res, rej;
    const promise = new Promise((r1, r2) => { res = r1; rej = r2; });
    const entry = { exports: {}, state: 'loading', baseUrl: finalUrl, promise, resolve: res, reject: rej };
    modules.set(finalUrl, entry);

    loadModuleAsync(specifier, finalUrl, source, entry).catch(err => {
      modules.delete(finalUrl);
      rej(err);
    });
    return promise;
  }

  async function loadModuleAsync(specifier, finalUrl, source, entry) {
    const importPaths = findImports(source);
    await Promise.all(importPaths.map(dep => loadModule(dep, finalUrl)));

    const ext = finalUrl.split('/').pop().split('?')[0].split('#')[0].split('.').pop();
    const shouldCompile = !specifier.includes('://') && ['ts', 'js'].includes(ext);

    let code = source;
    if (shouldCompile) {
      const result = await transform(source, {
        filename: finalUrl,
        jsc: {
          parser: { syntax: ext === 'ts' ? 'typescript' : 'ecmascript', tsx: false },
          target: 'es2020'
        },
        module: { type: 'commonjs' }
      });
      code = result.code;
    }

    entry.code = code;
    entry.state = 'compiled';
    entry.resolve(finalUrl);
  }

  function ensureExecuted(url) {
    const entry = modules.get(url);
    if (!entry) throw new Error(`Module ${url} not loaded`);
    if (entry.state === 'executed' || entry.state === 'executing') return entry.exports;
    if (entry.state !== 'compiled') throw new Error(`Module ${url} not compiled`);

    entry.state = 'executing';
    const moduleRequire = (dep) => {
      const depUrl = specifierToUrlMap.get(`${entry.baseUrl}|${dep}`);
      if (!depUrl) throw new Error(`Dependency ${dep} not found`);
      return ensureExecuted(depUrl);
    };

    const module = { exports: entry.exports };
    try {
      new Function('require', 'exports', 'module', entry.code)(moduleRequire, entry.exports, module);
      entry.exports = module.exports;
      entry.state = 'executed';
    } catch (err) {
      entry.state = 'error';
      throw err;
    }
    return entry.exports;
  }

  async function require(specifier, referrerUrl = baseURL) {
    const finalUrl = await loadModule(specifier, referrerUrl);
    return ensureExecuted(finalUrl);
  }

  async function executeInline(source) {
    const moduleId = `inline:${location.href}#${++inlineCounter}`;
    const importPaths = findImports(source);
    await Promise.all(importPaths.map(dep => loadModule(dep, baseURL)));

    const result = await transform(source, {
      filename: moduleId,
      jsc: { parser: { syntax: 'typescript', tsx: false }, target: 'es2020' },
      module: { type: 'commonjs' }
    });

    modules.set(moduleId, { exports: {}, state: 'compiled', code: result.code, baseUrl: baseURL });
    return ensureExecuted(moduleId);
  }

  async function processScriptTag(script) {
    if (script.dataset.tsProcessed) return;
    script.dataset.tsProcessed = 'true';

    const type = script.getAttribute('type');
    if (type !== 'text/tsm') return;
    await initSWC();

    const src = script.getAttribute('src');
    if (src) {
      require(src, new URL(src, document.baseURI).href).catch(err => console.error('Error:', err));
    } else {
      executeInline(script.textContent).catch(err => console.error('Error:', err));
    }
  }

  document.querySelectorAll('script[type="text/tsm"]').forEach(processScriptTag);

  new MutationObserver(mutations => {
    mutations.forEach(mut => mut.addedNodes.forEach(node => {
      if (node.nodeName === 'SCRIPT' && node.getAttribute('type') === 'text/tsm') {
        processScriptTag(node);
      }
    }));
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
