// @flow
import { getTabsToDisplay } from './HomePageMenu';

describe('HomePageMenu', () => {
  test('shows only project and play tabs', () => {
    expect(getTabsToDisplay().map(tab => tab.tab)).toEqual([
      'create',
      'play',
    ]);
  });
});
