import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProductScene from '../ProductScene.jsx';

describe('ProductScene', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('renders decorative 3D stack with all three product panels and aria-hidden', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    const { container } = render(<ProductScene />);
    const root = container.querySelector('.pscene-root');
    expect(root).toBeTruthy();
    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(root).toHaveAttribute('tabindex', '-1');
    expect(root).not.toHaveClass('is-reduced-motion');

    // Panel 1: Timetable grid
    expect(screen.getByText(/Semester V · Sec B/i)).toBeInTheDocument();
    // Panel 2: Notice card
    expect(screen.getByText(/Sem 5, Section B/i)).toBeInTheDocument();
    expect(screen.getByText(/14 Dec — detected deadline/i)).toBeInTheDocument();
    // Panel 3: Support signal card
    expect(screen.getByText(/Needs support/i)).toBeInTheDocument();
  });

  it('renders static stacked version without animation when prefers-reduced-motion is reduce', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    const { container } = render(<ProductScene />);
    const root = container.querySelector('.pscene-root');
    const stage = container.querySelector('.pscene-stage');

    expect(root).toHaveClass('is-reduced-motion');

    // Moving cursor should not apply tilt transform in reduced motion mode
    fireEvent.mouseMove(root, { clientX: 200, clientY: 150 });
    expect(stage.style.transform).toBe('');
  });
});
