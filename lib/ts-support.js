// magic-swc-loader.js – with automatic .ts/.js fallback and improved dependency detection
(function() {
  const SWC_URL = 'https://unpkg.com/@swc/wasm-web@1.3.92/wasm-web.js';

  const modules = new Map();
  const specifierToUrlMap = new Map();

  const baseURL = location.href.substring(0, location.href.lastIndexOf('/') + 1);
  let inlineCounter = 0;

  function resolvePath(path, base) {
    if (path.startsWith('./') || path.startsWith('../')) {
      return new URL(path, base).href;
    }
    if (path.startsWith('/')) {
      return new URL(path, location.origin).href;
    }
    return new URL(path, base).href;
  }

  // Enhanced static import/require detection
  function findImports(source) {
    const imports = new Set();

    // ES import statements
    const importRegex = /import\s+[^'"]*['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(source)) !== null) {
      imports.add(match[1]);
    }

    // export ... from statements (including export * from, export * as ... from, export { ... } from)
    const exportFromRegex = /export\s+(?:\*\s+as\s+\w+\s+from\s+['"]|\*\s+from\s+['"]|{[^}]*}\s+from\s+['"])([^'"]+)['"]/g;
    while ((match = exportFromRegex.exec(source)) !== null) {
      imports.add(match[1]);
    }

    // CommonJS require calls (static strings)
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(source)) !== null) {
      imports.add(match[1]);
    }

    return Array.from(imports);
  }

  let transform;
  async function initSWC() {
    if (transform) return;
    const { default: init, transform: swcTransform } = await import(SWC_URL);
    await init();
    transform = swcTransform;
  }

  async function tryFetch(url) {
    const res = await fetch(url);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    const source = await res.text();
    return { url, source };
  }

  async function resolveModule(specifier, referrerUrl) {
    if (specifier.includes('://')) {
      const result = await tryFetch(specifier);
      if (!result) throw new Error(`External module ${specifier} not found`);
      return result;
    }

    const base = new URL(referrerUrl);
    const [path, rest] = specifier.split(/([?#].*)/);
    const lastSegment = path.split('/').pop();
    const hasExtension = lastSegment.includes('.');

    const candidates = [];
    if (hasExtension) {
      candidates.push(specifier);
    } else {
      candidates.push(path + '.ts' + (rest || ''));
      candidates.push(path + '.js' + (rest || ''));
    }

    for (const cand of candidates) {
      const url = new URL(cand, base).href;
      const result = await tryFetch(url);
      if (result) return result;
    }
    throw new Error(`Cannot resolve module ${specifier} from ${referrerUrl} (tried: ${candidates.join(', ')})`);
  }

  async function loadModule(specifier, referrerUrl = baseURL) {
    const { url: finalUrl, source } = await resolveModule(specifier, referrerUrl);
    const key = `${referrerUrl}|${specifier}`;
    specifierToUrlMap.set(key, finalUrl);

    const existing = modules.get(finalUrl);
    if (existing) {
      if (existing.state === 'loading') return existing.promise;
      return Promise.resolve(finalUrl);
    }

    let resolvePromise, rejectPromise;
    const promise = new Promise((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });
    modules.set(finalUrl, {
      exports: {},
      state: 'loading',
      baseUrl: finalUrl,
      promise,
      resolve: resolvePromise,
      reject: rejectPromise
    });

    try {
      const importPaths = findImports(source);
      await Promise.all(importPaths.map(dep => loadModule(dep, finalUrl)));

      let code;
      const isExternal = specifier.includes('://');
      const extension = finalUrl.split('/').pop().split('?')[0].split('#')[0];
      const shouldCompile = !isExternal && (extension.endsWith('.ts') || extension.endsWith('.js'));

      if (shouldCompile) {
        const parserSyntax = extension.endsWith('.ts') ? 'typescript' : 'ecmascript';
        const result = await transform(source, {
          filename: finalUrl,
          jsc: {
            parser: { syntax: parserSyntax, tsx: false },
            target: 'es2020'
          },
          module: { type: 'commonjs' }
        });
        code = result.code;
      } else {
        code = source;
      }

      const entry = modules.get(finalUrl);
      entry.code = code;
      entry.state = 'compiled';
      resolvePromise(finalUrl);
      return finalUrl;
    } catch (err) {
      modules.delete(finalUrl);
      rejectPromise(err);
      throw err;
    }
  }

  function ensureExecuted(url) {
    const entry = modules.get(url);
    if (!entry) throw new Error(`Module ${url} not loaded`);

    if (entry.state === 'executed') return entry.exports;
    if (entry.state === 'executing') return entry.exports;

    if (entry.state !== 'compiled') {
      throw new Error(`Module ${url} is not compiled (state=${entry.state})`);
    }

    entry.state = 'executing';

    const moduleRequire = (dep) => {
      const key = `${entry.baseUrl}|${dep}`;
      const depUrl = specifierToUrlMap.get(key);
      if (!depUrl) {
        throw new Error(`Dependency ${dep} not found for ${entry.baseUrl}`);
      }
      return ensureExecuted(depUrl);
    };

    const module = { exports: entry.exports };
    const wrapper = new Function('require', 'exports', 'module', entry.code);

    try {
      wrapper(moduleRequire, entry.exports, module);
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

  async function executeInline(source, scriptElement) {
    const moduleId = `inline:${location.href}#${++inlineCounter}`;
    if (modules.has(moduleId)) return modules.get(moduleId).exports;

    const importPaths = findImports(source);
    await Promise.all(importPaths.map(dep => loadModule(dep, baseURL)));

    const result = await transform(source, {
      filename: moduleId,
      jsc: {
        parser: { syntax: 'typescript', tsx: false },
        target: 'es2020'
      },
      module: { type: 'commonjs' }
    });

    const entry = {
      exports: {},
      state: 'compiled',
      code: result.code,
      baseUrl: baseURL,
    };
    modules.set(moduleId, entry);

    return ensureExecuted(moduleId);
  }

  async function processScriptTag(script) {
    if (script.dataset.tsProcessed) return;
    script.dataset.tsProcessed = 'true';

    const src = script.getAttribute('src');
    const type = script.getAttribute('type');
    if (type !== 'text/typescript') return;

    await initSWC();

    if (src) {
      script.setAttribute('type', 'text/typescript');
      const scriptBase = new URL(src, document.baseURI).href;
      require(src, scriptBase).catch(err => console.error('Error in external module:', err));
    } else {
      const source = script.textContent;
      executeInline(source, script).catch(err => console.error('Error in inline module:', err));
    }
  }

  document.querySelectorAll('script[type="text/typescript"]').forEach(processScriptTag);

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mut => {
      mut.addedNodes.forEach(node => {
        if (node.nodeName === 'SCRIPT' && node.getAttribute('type') === 'text/typescript') {
          processScriptTag(node);
        }
      });
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();