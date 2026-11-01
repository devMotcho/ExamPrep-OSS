// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StudentClassicDashboard, StudentTabbedDashboard, toStudentTab } from './StudentCompositions';

const sections = { intro: <p>intro</p>, areas: <p>areas</p>, sessions: <p>sessions</p>, progress: <p>progress</p>, calendar: <p>calendar</p> };
const tabProps = { sections, onTabChange: () => undefined };

afterEach(cleanup);

describe('toStudentTab', () => {
  it('opens on study unless the URL names another tab', () => {
    expect(toStudentTab(null)).toBe('study');
    expect(toStudentTab('nonsense')).toBe('study');
    expect(toStudentTab('progress')).toBe('progress');
    expect(toStudentTab('history')).toBe('history');
  });
});

describe('student dashboards', () => {
  it('classic layout shows everything without tabs', () => {
    render(<StudentClassicDashboard sections={sections} />);
    for (const name of ['intro', 'areas', 'sessions', 'progress', 'calendar']) expect(screen.getByText(name)).toBeTruthy();
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('keeps the next step visible on every tab', () => {
    for (const tab of ['study', 'progress', 'history'] as const) {
      const { unmount } = render(<StudentTabbedDashboard {...tabProps} tab={tab} />);
      expect(screen.getByText('intro')).toBeTruthy();
      unmount();
    }
  });

  it('places each section in its tab', () => {
    render(<StudentTabbedDashboard {...tabProps} tab="study" readiness={<p>readiness</p>} />);
    expect(screen.getByText('areas')).toBeTruthy();
    expect(screen.queryByText('readiness')).toBeNull();
    cleanup();
    render(<StudentTabbedDashboard {...tabProps} tab="progress" readiness={<p>readiness</p>} />);
    expect(screen.getByText('progress')).toBeTruthy();
    expect(screen.getByText('readiness')).toBeTruthy();
    cleanup();
    render(<StudentTabbedDashboard {...tabProps} tab="history" />);
    expect(screen.getByText('sessions')).toBeTruthy();
    expect(screen.getByText('calendar')).toBeTruthy();
  });

  it('reports tab changes', () => {
    const onTabChange = vi.fn();
    render(<StudentTabbedDashboard sections={sections} tab="study" onTabChange={onTabChange} />);
    fireEvent.click(screen.getAllByRole('tab')[2]);
    expect(onTabChange).toHaveBeenCalledWith('history');
  });
});
