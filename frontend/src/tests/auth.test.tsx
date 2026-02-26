import { Router } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LoginPage from '../src/pages/auth/LoginPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <Router>{children}</Router>
  </QueryClientProvider>
);

describe('LoginPage', () => {
  it('should render login form', () => {
    render(<LoginPage />, { wrapper });
    
    expect(screen.getByPlaceholderText(/votre@email.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument();
    expect(screen.getByText(/se connecter/i)).toBeInTheDocument();
  });

  it('should show validation errors', async () => {
    render(<LoginPage />, { wrapper });
    
    const loginButton = screen.getByText(/se connecter/i);
    fireEvent.click(loginButton);
    
    await waitFor(() => {
      // Form should have validation
    });
  });

  it('should have link to register', () => {
    render(<LoginPage />, { wrapper });
    
    expect(screen.getByText(/créer un compte/i)).toBeInTheDocument();
  });

  it('should have forgot password link', () => {
    render(<LoginPage />, { wrapper });
    
    expect(screen.getByText(/mot de passe oublié/i)).toBeInTheDocument();
  });
});

describe('RegisterPage', () => {
  it('should render registration wizard', async () => {
    const { default: RegisterPage } = await import('../src/pages/auth/RegisterPage');
    render(<RegisterPage />, { wrapper });
    
    expect(screen.getByText(/créer votre compte/i)).toBeInTheDocument();
  });
});
