import { showActionResult } from "@/lib/toast";
import { toast } from "sonner";

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

describe("showActionResult", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("성공 시 toast.success 호출하고 true 반환", () => {
    const result = showActionResult({ success: true });
    expect(toast.success).toHaveBeenCalledWith("저장되었습니다.");
    expect(result).toBe(true);
  });

  it("실패 시 toast.error 호출하고 false 반환", () => {
    const result = showActionResult({
      success: false,
      error: "권한이 없습니다.",
    });
    expect(toast.error).toHaveBeenCalledWith("권한이 없습니다.");
    expect(result).toBe(false);
  });

  it("커스텀 성공 메시지 사용", () => {
    const result = showActionResult({ success: true }, "멤버가 추가되었습니다.");
    expect(toast.success).toHaveBeenCalledWith("멤버가 추가되었습니다.");
    expect(result).toBe(true);
  });

  it("성공 + warning 시 둘 다 표시", () => {
    const result = showActionResult({
      success: true,
      warning: "일부 데이터가 누락됐습니다.",
    });
    expect(toast.success).toHaveBeenCalledWith("저장되었습니다.");
    expect(toast.warning).toHaveBeenCalledWith("일부 데이터가 누락됐습니다.");
    expect(result).toBe(true);
  });
});
