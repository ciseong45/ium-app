import { memberSchema } from "@/lib/validations";

describe("memberSchema - 성/이름 분리", () => {
  it("last_name(성)은 필수", () => {
    const result = memberSchema.safeParse({
      first_name: "철수",
      status: "active",
    });
    expect(result.success).toBe(false);
  });

  it("first_name(이름)은 필수", () => {
    const result = memberSchema.safeParse({
      last_name: "김",
      status: "active",
    });
    expect(result.success).toBe(false);
  });

  it("last_name + first_name 정상 입력 시 통과", () => {
    const result = memberSchema.safeParse({
      last_name: "김",
      first_name: "철수",
      phone: null,
      email: null,
      gender: null,
      birth_date: null,
      address: null,
      status: "active",
      kakao_id: null,
      is_baptized: false,
      school_or_work: null,
      notes: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.last_name).toBe("김");
      expect(result.data.first_name).toBe("철수");
    }
  });

  it("last_name은 최대 10자", () => {
    const result = memberSchema.safeParse({
      last_name: "김".repeat(11),
      first_name: "철수",
      status: "active",
    });
    expect(result.success).toBe(false);
  });

  it("first_name은 최대 40자", () => {
    const result = memberSchema.safeParse({
      last_name: "김",
      first_name: "가".repeat(41),
      status: "active",
    });
    expect(result.success).toBe(false);
  });

  it("기존 name 필드는 더 이상 존재하지 않음", () => {
    const result = memberSchema.safeParse({
      name: "김철수",
      status: "active",
    });
    // name만으로는 통과하면 안 됨 (last_name, first_name 필수)
    expect(result.success).toBe(false);
  });
});
