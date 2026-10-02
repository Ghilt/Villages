import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { createStore } from '@villages/client-core';

import { useStore } from './useStore';

describe('useStore', () => {
  it('hands a component the whole of a store, or the part it picks', () => {
    const store = createStore({ name: 'Ravenscar', wealth: 40 });
    function Card() {
      const all = useStore(store);
      const wealth = useStore(store, (house) => house.wealth);
      return createElement('p', null, `${all.name} ${wealth}`);
    }

    expect(renderToStaticMarkup(createElement(Card))).toBe('<p>Ravenscar 40</p>');
    store.set({ wealth: 100 });
    expect(renderToStaticMarkup(createElement(Card))).toBe('<p>Ravenscar 100</p>');
  });
});
