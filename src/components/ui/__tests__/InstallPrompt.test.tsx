/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, act } from "@testing-library/react";
import InstallPrompt from "../InstallPrompt";

// matchMedia mock
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe("InstallPrompt", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("standalone 모드에서는 표시하지 않는다", () => {
    // standalone 모드 모킹
    (window.matchMedia as jest.Mock).mockImplementation((query: string) => ({
      matches: query === "(display-mode: standalone)",
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    const { container } = render(<InstallPrompt />);
    expect(container.firstChild).toBeNull();
  });

  it("beforeinstallprompt 이벤트 시 배너를 표시한다", () => {
    // non-standalone
    (window.matchMedia as jest.Mock).mockImplementation(() => ({
      matches: false,
      media: "",
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    render(<InstallPrompt />);

    act(() => {
      const event = new Event("beforeinstallprompt");
      Object.defineProperty(event, "preventDefault", { value: jest.fn() });
      window.dispatchEvent(event);
    });

    expect(
      screen.getByText("홈 화면에 추가")
    ).toBeInTheDocument();
  });

  it("닫기 버튼 클릭 시 배너를 숨기고 localStorage에 저장한다", () => {
    (window.matchMedia as jest.Mock).mockImplementation(() => ({
      matches: false,
      media: "",
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    render(<InstallPrompt />);

    act(() => {
      const event = new Event("beforeinstallprompt");
      Object.defineProperty(event, "preventDefault", { value: jest.fn() });
      window.dispatchEvent(event);
    });

    const closeButton = screen.getByLabelText("닫기");
    fireEvent.click(closeButton);

    expect(screen.queryByText("홈 화면에 추가")).not.toBeInTheDocument();
    expect(localStorage.getItem("pwa-install-dismissed")).toBeTruthy();
  });

  it("localStorage에 최근 닫기 기록이 있으면 표시하지 않는다", () => {
    // 3일 전 닫기 기록
    localStorage.setItem(
      "pwa-install-dismissed",
      String(Date.now())
    );

    (window.matchMedia as jest.Mock).mockImplementation(() => ({
      matches: false,
      media: "",
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    render(<InstallPrompt />);

    act(() => {
      const event = new Event("beforeinstallprompt");
      Object.defineProperty(event, "preventDefault", { value: jest.fn() });
      window.dispatchEvent(event);
    });

    expect(screen.queryByText("홈 화면에 추가")).not.toBeInTheDocument();
  });
});
