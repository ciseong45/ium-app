import { toast } from "sonner";
import type { ActionResult } from "@/lib/validations";

/**
 * Server action 결과를 toast로 표시하는 헬퍼
 * @returns success 여부 (true: 성공, false: 실패)
 */
export function showActionResult(
  result: ActionResult,
  successMessage: string = "저장되었습니다."
): boolean {
  if (result.success) {
    toast.success(successMessage);
    if (result.warning) {
      toast.warning(result.warning);
    }
    return true;
  } else {
    toast.error(result.error);
    return false;
  }
}
