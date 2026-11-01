// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';

afterEach(cleanup);

const Locale = () => {
  const { locale } = useParams();
  return <div data-testid="locale">{locale}<Outlet /></div>;
};
const Where = () => <span data-testid="where">{useLocation().pathname}</span>;

/** The route shapes in App.tsx: a locale parent, pathless layouts, an index and a fallback in each level. */
const app = (start: string) => render(
  <MemoryRouter initialEntries={[start]}>
    <Where />
    <Routes>
      <Route path="/" element={<Navigate to="/en/dashboard" replace />} />
      <Route path="/:locale" element={<Locale />}>
        <Route index element={<p>home</p>} />
        <Route element={<Outlet />}>
          <Route path="study-areas/:id/edit" element={<Link to="/pt/contact">go</Link>} />
          <Route path="contact" element={<p>contact</p>} />
          <Route path="dashboard" element={<p>dashboard</p>} />
        </Route>
        <Route path="*" element={<p>not found</p>} />
      </Route>
    </Routes>
  </MemoryRouter>,
);

describe('routing', () => {
  it('redirects the root to a locale', () => {
    app('/');
    expect(screen.getByTestId('where').textContent).toBe('/en/dashboard');
    expect(screen.getByText('dashboard')).toBeTruthy();
  });

  it('reads the locale through pathless layouts', () => {
    app('/pt/study-areas/1/edit');
    expect(screen.getByTestId('locale').textContent).toContain('pt');
  });

  it('follows a link', async () => {
    app('/pt/study-areas/1/edit');
    await act(async () => { screen.getByText('go').click(); });
    expect(screen.getByTestId('where').textContent).toBe('/pt/contact');
  });

  it('shows the fallback inside a locale', () => {
    app('/pt/nothing/here');
    expect(screen.getByText('not found')).toBeTruthy();
  });
});
