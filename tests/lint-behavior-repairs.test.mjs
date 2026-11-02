import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
function load(file, mocks = {}, globals = {}) {
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', ...Object.keys(globals), js)(
    mod, mod.exports, name => name in mocks ? mocks[name] : require(name), ...Object.values(globals),
  );
  return mod.exports;
}

function elements(node, predicate) {
  if (!React.isValidElement(node)) return [];
  return [
    ...(predicate(node) ? [node] : []),
    ...React.Children.toArray(node.props.children).flatMap(child => elements(child, predicate)),
  ];
}

test('empty dashboard buttons use the actions supplied by the parent', () => {
  const calls = [];
  const Component = load('app/client/dashboard/EmptyDashboard.tsx').default;
  const tree = Component({
    onPostJob: () => calls.push('post'),
    onCompleteProfile: () => calls.push('profile'),
    onContactSupport: () => calls.push('support'),
    isTrialActive: false,
    trialDaysLeft: null,
  });
  const buttons = elements(tree, node => node.type === 'button');
  assert.equal(buttons.length, 3);
  buttons.forEach(button => button.props.onClick());
  assert.deepEqual(calls, ['post', 'profile', 'support']);
});

test('dashboard error banner displays and safely escapes the supplied explanation', () => {
  const { DashboardErrorBanner } = load('app/client/dashboard/DashboardStates.tsx', {
    'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
    '@/lib/supabase': { supabase: {} },
  });
  const html = renderToStaticMarkup(React.createElement(DashboardErrorBanner, {
    message: 'Jobs unavailable <script>unsafe</script>', onRetry: () => {},
  }));
  assert.match(html, /Jobs unavailable &lt;script&gt;unsafe&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

function layoutHarness(initialPath = '/guard/dashboard') {
  let pathname = initialPath;
  let cursor = 0;
  let rerender = false;
  let timer;
  let authCallback;
  let signOuts = 0;
  let subscriptions = 0;
  let unsubscriptions = 0;
  const hooks = [], pending = [], listeners = new Map(), redirects = [];
  const router = { push: path => redirects.push(path) };
  const useState = initial => {
    const index = cursor++;
    hooks[index] ??= { value: initial };
    return [hooks[index].value, value => { hooks[index].value = value; rerender = true; }];
  };
  const useEffect = (effect, deps) => {
    const index = cursor++;
    const previous = hooks[index];
    if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) {
      pending.push(() => {
        previous?.cleanup?.();
        hooks[index] = { deps, cleanup: effect() };
      });
    }
  };
  const Component = load('app/ClientLayout.tsx', {
    react: { ...React, useState, useEffect },
    'next/navigation': { usePathname: () => pathname },
    'next/dynamic': { default: () => () => null },
    '@/lib/supabase': { supabase: { auth: {
      onAuthStateChange: callback => {
        subscriptions++;
        authCallback = callback;
        return { data: { subscription: { unsubscribe: () => { unsubscriptions++; } } } };
      },
      signOut: async () => { signOuts++; },
    } } },
    '@/hooks/useSafeRouter': { useSafeRouter: () => router },
    '@/components/MaintenanceWrapper': { default: () => null },
    '@/components/RealtimeToast': { default: () => null },
  }, {
    window: {
      addEventListener: (event, listener) => listeners.set(event, listener),
      removeEventListener: (event, listener) => { if (listeners.get(event) === listener) listeners.delete(event); },
    },
    setTimeout: callback => { timer = callback; return 1; },
    clearTimeout: () => { timer = undefined; },
  }).default;
  const render = () => {
    rerender = false;
    cursor = 0;
    Component({ children: null });
    pending.splice(0).forEach(effect => effect());
  };
  return {
    render,
    mount: () => { timer(); assert(rerender); render(); },
    navigate: path => { pathname = path; render(); },
    signedOut: () => authCallback('SIGNED_OUT'),
    rejectToken: () => {
      const event = { reason: new Error('Invalid Refresh Token'), preventDefault() { this.prevented = true; } };
      listeners.get('unhandledrejection')(event);
      return event;
    },
    unmount: () => hooks.forEach(hook => hook.cleanup?.()),
    get subscriptions() { return subscriptions; },
    get unsubscriptions() { return unsubscriptions; },
    get signOuts() { return signOuts; },
    listeners, redirects,
  };
}

test('layout installs delayed auth listeners, refreshes route closures and cleans up', async () => {
  const h = layoutHarness();
  h.render();
  assert.equal(h.subscriptions, 0);
  assert.equal(h.listeners.size, 0);
  h.mount();
  assert.equal(h.subscriptions, 1);
  assert.equal(h.listeners.size, 1);
  h.signedOut();
  assert.deepEqual(h.redirects, ['/']);
  const event = h.rejectToken();
  assert(event.prevented);
  await Promise.resolve();
  assert.equal(h.signOuts, 1);
  assert.deepEqual(h.redirects, ['/', '/guard/login']);
  h.navigate('/jobs');
  assert.equal(h.unsubscriptions, 1);
  h.signedOut();
  assert.equal(h.redirects.length, 2);
  h.navigate('/client/dashboard');
  h.rejectToken();
  await Promise.resolve();
  assert.equal(h.redirects.at(-1), '/client/login');
  h.unmount();
  assert.equal(h.subscriptions, h.unsubscriptions);
  assert.equal(h.listeners.size, 0);
});

test('layout cancels its timer when removed before mounting', () => {
  const h = layoutHarness();
  h.render();
  h.unmount();
  assert.equal(h.subscriptions, 0);
  assert.equal(h.listeners.size, 0);
});
