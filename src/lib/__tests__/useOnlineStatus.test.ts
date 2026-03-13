/**
 * @jest-environment jsdom
 */
import { renderHook, act } from "@testing-library/react";
import { useOnlineStatus } from "../useOnlineStatus";

describe("useOnlineStatus", () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    "navigator"
  );

  function setOnLine(value: boolean) {
    Object.defineProperty(navigator, "onLine", {
      value,
      writable: true,
      configurable: true,
    });
  }

  afterEach(() => {
    // restore
    if (originalNavigator) {
      Object.defineProperty(globalThis, "navigator", originalNavigator);
    }
  });

  it("기본값은 online(true)이다", () => {
    setOnLine(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });

  it("offline 이벤트 시 false로 전환된다", () => {
    setOnLine(true);
    const { result } = renderHook(() => useOnlineStatus());

    act(() => {
      setOnLine(false);
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current).toBe(false);
  });

  it("online 이벤트 시 true로 복구된다", () => {
    setOnLine(false);
    const { result } = renderHook(() => useOnlineStatus());

    act(() => {
      setOnLine(true);
      window.dispatchEvent(new Event("online"));
    });

    expect(result.current).toBe(true);
  });

  it("언마운트 시 이벤트 리스너를 제거한다", () => {
    const removeSpy = jest.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useOnlineStatus());

    unmount();

    const removedTypes = removeSpy.mock.calls.map((call) => call[0]);
    expect(removedTypes).toContain("online");
    expect(removedTypes).toContain("offline");

    removeSpy.mockRestore();
  });
});
