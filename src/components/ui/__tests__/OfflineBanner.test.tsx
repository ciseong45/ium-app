/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import OfflineBanner from "../OfflineBanner";
import * as onlineStatus from "@/lib/useOnlineStatus";

jest.mock("@/lib/useOnlineStatus");
const mockedUseOnlineStatus = onlineStatus.useOnlineStatus as jest.MockedFunction<
  typeof onlineStatus.useOnlineStatus
>;

describe("OfflineBanner", () => {
  it("오프라인 시 배너를 렌더링한다", () => {
    mockedUseOnlineStatus.mockReturnValue(false);

    render(<OfflineBanner />);

    expect(
      screen.getByText("오프라인 상태입니다. 일부 기능이 제한될 수 있습니다.")
    ).toBeInTheDocument();
  });

  it("온라인 시 배너를 렌더링하지 않는다", () => {
    mockedUseOnlineStatus.mockReturnValue(true);

    const { container } = render(<OfflineBanner />);

    expect(container.firstChild).toBeNull();
  });

  it("배너에 올바른 스타일 클래스가 적용된다", () => {
    mockedUseOnlineStatus.mockReturnValue(false);

    render(<OfflineBanner />);
    const banner = screen.getByRole("alert");

    expect(banner).toHaveClass("fixed");
    expect(banner).toHaveClass("z-[100]");
  });
});
