import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ForbiddenPage from '../ForbiddenPage.jsx';
import * as AuthContextModule from '../../app/AuthContext.jsx';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('ForbiddenPage (403)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects student to /student/home when clicking Back to my home', async () => {
    const user = userEvent.setup();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { role: 'student' },
      activeRole: 'student',
      isLoggedIn: true,
    });

    render(
      <MemoryRouter>
        <ForbiddenPage />
      </MemoryRouter>
    );

    const btn = screen.getByRole('button', { name: /Back to my home/i });
    await user.click(btn);

    expect(mockNavigate).toHaveBeenCalledWith('/student/home', { replace: true });
  });

  it('redirects faculty/mentor to /faculty/home when clicking Back to my home', async () => {
    const user = userEvent.setup();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { role: 'faculty' },
      activeRole: 'mentor',
      isLoggedIn: true,
    });

    render(
      <MemoryRouter>
        <ForbiddenPage />
      </MemoryRouter>
    );

    const btn = screen.getByRole('button', { name: /Back to my home/i });
    await user.click(btn);

    expect(mockNavigate).toHaveBeenCalledWith('/faculty/home', { replace: true });
  });

  it('redirects coordinator to /coordinator/summary when clicking Back to my home', async () => {
    const user = userEvent.setup();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { role: 'coordinator' },
      activeRole: 'coordinator',
      isLoggedIn: true,
    });

    render(
      <MemoryRouter>
        <ForbiddenPage />
      </MemoryRouter>
    );

    const btn = screen.getByRole('button', { name: /Back to my home/i });
    await user.click(btn);

    expect(mockNavigate).toHaveBeenCalledWith('/coordinator/summary', { replace: true });
  });

  it('redirects unauthenticated user to /login when clicking Back to my home', async () => {
    const user = userEvent.setup();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      activeRole: null,
      isLoggedIn: false,
    });

    render(
      <MemoryRouter>
        <ForbiddenPage />
      </MemoryRouter>
    );

    const btn = screen.getByRole('button', { name: /Back to my home/i });
    await user.click(btn);

    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });
});
