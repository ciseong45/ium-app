/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import LoginPage from "../page";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

// Mock supabase client
const mockSignInWithPassword = jest.fn().mockResolvedValue({ error: null });
const mockSignInWithOAuth = jest.fn().mockResolvedValue({ error: null });

jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signInWithOAuth: mockSignInWithOAuth,
    },
  }),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Google 로그인 버튼이 렌더링된다", () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: /google/i })).toBeInTheDocument();
  });

  it("Google 버튼 클릭 시 signInWithOAuth가 provider: google로 호출된다", () => {
    render(<LoginPage />);
    const googleBtn = screen.getByRole("button", { name: /google/i });
    fireEvent.click(googleBtn);

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: expect.stringContaining("/auth/callback"),
      },
    });
  });

  it("기존 이메일/비밀번호 로그인 폼도 여전히 존재한다", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/이메일/)).toBeInTheDocument();
    expect(screen.getByLabelText(/비밀번호/)).toBeInTheDocument();
  });
});
