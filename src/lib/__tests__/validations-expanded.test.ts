import { ZodError } from "zod";
import {
  visitorCardSchema,
  seasonSchema,
  groupSchema,
  oneToOneSchema,
  parseFormData,
  memberSchema,
} from "@/lib/validations";

// ===== visitorCardSchema =====

describe("visitorCardSchema", () => {
  it("last_name과 first_name은 필수", () => {
    const result = visitorCardSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("유효한 전체 데이터 입력 시 통과", () => {
    const result = visitorCardSchema.safeParse({
      last_name: "박",
      first_name: "지영",
      phone: "010-1234-5678",
      kakao_id: "jipark",
      gender: "F",
      birth_date: "2000-01-15",
      baptism: "세례",
      school_work: "BU",
      previous_church: "서울교회",
    });
    expect(result.success).toBe(true);
  });

  it("선택 필드는 null 허용", () => {
    const result = visitorCardSchema.safeParse({
      last_name: "이",
      first_name: "민수",
      phone: null,
      kakao_id: null,
      gender: null,
      birth_date: null,
      baptism: null,
      school_work: null,
      previous_church: null,
    });
    expect(result.success).toBe(true);
  });

  it("phone은 최대 20자", () => {
    const result = visitorCardSchema.safeParse({
      last_name: "김",
      first_name: "철수",
      phone: "0".repeat(21),
    });
    expect(result.success).toBe(false);
  });

  it("school_work는 최대 100자", () => {
    const result = visitorCardSchema.safeParse({
      last_name: "김",
      first_name: "철수",
      school_work: "가".repeat(101),
    });
    expect(result.success).toBe(false);
  });
});

// ===== seasonSchema =====

describe("seasonSchema", () => {
  it("name은 필수", () => {
    const result = seasonSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("유효한 시즌 데이터 통과", () => {
    const result = seasonSchema.safeParse({
      name: "2026 봄학기",
      start_date: "2026-03-01",
      end_date: "2026-06-30",
      is_active: true,
    });
    expect(result.success).toBe(true);
  });

  it("name은 최대 50자", () => {
    const result = seasonSchema.safeParse({
      name: "가".repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it("is_active 기본값은 false", () => {
    const result = seasonSchema.safeParse({
      name: "2026 여름학기",
      start_date: null,
      end_date: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_active).toBe(false);
    }
  });
});

// ===== groupSchema =====

describe("groupSchema", () => {
  it("name은 필수", () => {
    const result = groupSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("유효한 그룹 데이터 통과", () => {
    const result = groupSchema.safeParse({
      name: "1순",
      leader_id: 42,
    });
    expect(result.success).toBe(true);
  });

  it("name은 최대 50자", () => {
    const result = groupSchema.safeParse({
      name: "가".repeat(51),
      leader_id: null,
    });
    expect(result.success).toBe(false);
  });

  it("leader_id는 null 허용", () => {
    const result = groupSchema.safeParse({
      name: "2순",
      leader_id: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.leader_id).toBeNull();
    }
  });
});

// ===== oneToOneSchema =====

describe("oneToOneSchema", () => {
  it("mentor_id와 mentee_id는 필수", () => {
    const result = oneToOneSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("유효한 일대일 데이터 통과", () => {
    const result = oneToOneSchema.safeParse({
      mentor_id: 1,
      mentee_id: 2,
      started_at: "2026-03-01",
    });
    expect(result.success).toBe(true);
  });

  it("started_at은 필수", () => {
    const result = oneToOneSchema.safeParse({
      mentor_id: 1,
      mentee_id: 2,
    });
    expect(result.success).toBe(false);
  });

  it("멘토와 멘티가 같으면 실패", () => {
    const result = oneToOneSchema.safeParse({
      mentor_id: 5,
      mentee_id: 5,
      started_at: "2026-03-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "멘토와 멘티는 다른 사람이어야 합니다."
      );
    }
  });

  it("mentor_id가 숫자가 아니면 실패", () => {
    const result = oneToOneSchema.safeParse({
      mentor_id: "abc",
      mentee_id: 2,
      started_at: "2026-03-01",
    });
    expect(result.success).toBe(false);
  });
});

// ===== parseFormData =====

describe("parseFormData", () => {
  it("빈 문자열을 null로 변환", () => {
    const formData = new FormData();
    formData.append("last_name", "김");
    formData.append("first_name", "철수");
    formData.append("phone", "");
    formData.append("email", "");
    formData.append("gender", "");
    formData.append("birth_date", "");
    formData.append("address", "");
    formData.append("status", "active");
    formData.append("kakao_id", "");
    formData.append("is_baptized", "false");
    formData.append("school_or_work", "");
    formData.append("notes", "");

    const result = parseFormData(memberSchema, formData);
    expect(result.phone).toBeNull();
    expect(result.email).toBeNull();
    expect(result.gender).toBeNull();
  });

  it("유효한 값은 그대로 보존", () => {
    const formData = new FormData();
    formData.append("last_name", "박");
    formData.append("first_name", "지영");
    formData.append("phone", "010-1234-5678");
    formData.append("email", "");
    formData.append("gender", "F");
    formData.append("birth_date", "");
    formData.append("address", "");
    formData.append("status", "active");
    formData.append("kakao_id", "");
    formData.append("is_baptized", "true");
    formData.append("school_or_work", "");
    formData.append("notes", "");

    const result = parseFormData(memberSchema, formData);
    expect(result.last_name).toBe("박");
    expect(result.first_name).toBe("지영");
    expect(result.phone).toBe("010-1234-5678");
    expect(result.is_baptized).toBe(true);
  });

  it("유효성 검사 실패 시 ZodError 발생", () => {
    const formData = new FormData();
    formData.append("last_name", "");
    formData.append("first_name", "");

    expect(() => parseFormData(memberSchema, formData)).toThrow(ZodError);
  });
});
