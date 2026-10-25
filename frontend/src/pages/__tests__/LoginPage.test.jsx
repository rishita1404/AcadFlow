import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../LoginPage.jsx';
import SignInCard from '../../features/auth/SignInCard.jsx';
import * as AuthContextModule from '../../app/AuthContext.jsx';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('LoginPage & Auth Features', () => {
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      login: mockLogin,
      isLoggedIn: false,
      user: null,
    });
  });

  it('renders all required form fields, landmarks, and brand elements', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    // Landmarks
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();

    // Brand and headline
    expect(screen.getByText('AcadFlow')).toBeInTheDocument();
    expect(screen.getAllByText(/Unified Academic Platform/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Know where you stand, before it's too late\./i)).toBeInTheDocument();

    // Inputs & buttons
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Forgot password\?/i })).toBeInTheDocument();

    // Dynamic copyright year in footer
    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(year))).toBeInTheDocument();
  });

  it('toggles password visibility with accessible aria-label and aria-pressed', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const passwordInput = screen.getByLabelText(/^Password/i);
    const toggleBtn = screen.getByRole('button', { name: /Show password/i });

    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggleBtn);

    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /Hide password/i })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: /Hide password/i }));

    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('validates required fields and basic email format on submit and blur', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const submitBtn = screen.getByRole('button', { name: /Sign in/i });

    // Submit empty
    await user.click(submitBtn);

    expect(screen.getByText(/Email is required\./i)).toBeInTheDocument();
    expect(screen.getByText(/Password is required\./i)).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();

    // Enter invalid email format
    const emailInput = screen.getByLabelText(/Email/i);
    await user.type(emailInput, 'invalid-email');
    fireEvent.blur(emailInput);

    expect(screen.getByText(/Please enter a valid email address\./i)).toBeInTheDocument();
  });

  it('displays 401 friendly error message when credentials are wrong', async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValueOnce({
      response: { status: 401, data: { detail: 'Unauthorized' } },
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/Email/i), 'student@acadflow.edu');
    await user.type(screen.getByLabelText(/^Password/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /Sign in/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("That email or password doesn't look right. Please try again.");
  });

  it('displays 429 rate-limited message with countdown and disables submit button', async () => {
    const user = userEvent.setup();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    mockLogin.mockRejectedValueOnce({
      response: {
        status: 429,
        headers: { 'retry-after': '65' }, // 1 min 5 secs
      },
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/Email/i), 'student@acadflow.edu');
    await user.type(screen.getByLabelText(/^Password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /Sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Too many attempts\. You can try again in 1:05\./i);
    });

    const submitBtn = screen.getByRole('button', { name: /Sign in/i });
    expect(submitBtn).toBeDisabled();

    // Advance 6 seconds
    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/Too many attempts\. You can try again in 0:59\./i);

    vi.useRealTimers();
  });

  it('displays 403 admin-locked account message', async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValueOnce({
      response: { status: 403, data: { detail: 'Forbidden' } },
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/Email/i), 'locked@acadflow.edu');
    await user.type(screen.getByLabelText(/^Password/i), 'pass123');
    await user.click(screen.getByRole('button', { name: /Sign in/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('This account is locked. Please contact an administrator.');
  });

  it('respects ?next= query param on successful login', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValueOnce({ role: 'student' });

    render(
      <MemoryRouter initialEntries={['/login?next=/student/calendar']}>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/Email/i), 'student@acadflow.edu');
    await user.type(screen.getByLabelText(/^Password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /Sign in/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/student/calendar', { replace: true });
    });
  });

  it('opens accessible dialog for forgot password link', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const forgotBtn = screen.getByRole('button', { name: /Forgot password\?/i });
    await user.click(forgotBtn);

    expect(screen.getByText(/Please contact your course coordinator or administrator to reset your password\./i)).toBeInTheDocument();
  });

  it('fills form fields when demo accounts are clicked without exposing password', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const facultyChip = screen.getByRole('button', { name: /Fill credentials for Faculty/i });
    await user.click(facultyChip);

    const emailInput = screen.getByLabelText(/Email/i);
    const passwordInput = screen.getByLabelText(/^Password/i);

    expect(emailInput).toHaveValue('faculty@acadflow.edu');
    expect(passwordInput).toHaveValue('AcadFlow@123');
    // Ensure the raw password is not rendered as visible text in the UI
    expect(screen.queryByText('AcadFlow@123')).not.toBeInTheDocument();
    // Did not auto-submit
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('hides demo accounts when not in DEV environment', () => {
    // Render isolated SignInCard with import.meta.env.DEV overridden
    const origDev = import.meta.env.DEV;
    try {
      import.meta.env.DEV = false;
      render(
        <SignInCard
          onLogin={vi.fn()}
          isExpired={false}
          onOpenDialog={vi.fn()}
        />
      );
      expect(screen.queryByText(/Demo accounts \(development only\)/i)).not.toBeInTheDocument();
    } finally {
      import.meta.env.DEV = origDev;
    }
  });
});
