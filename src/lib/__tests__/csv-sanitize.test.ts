import { escapeCsvField } from "@/lib/csv";

describe("escapeCsvField - CSV 수식 인젝션 방어", () => {
  // 위험한 수식 문자로 시작하는 값 방어
  it("= 로 시작하는 값에 접두사 추가", () => {
    expect(escapeCsvField("=cmd|'/c calc'!A1")).not.toMatch(/^=/);
    expect(escapeCsvField("=1+1")).not.toMatch(/^=/);
  });

  it("+ 로 시작하는 값에 접두사 추가", () => {
    expect(escapeCsvField("+cmd|'/c calc'!A1")).not.toMatch(/^\+/);
  });

  it("- 로 시작하는 값에 접두사 추가", () => {
    expect(escapeCsvField("-cmd|'/c calc'!A1")).not.toMatch(/^-/);
    // 따옴표로 감싸진 경우 내부 첫 문자 체크
    const result = escapeCsvField("-cmd|'/c calc'!A1");
    expect(result).toContain("'");
  });

  it("@ 로 시작하는 값에 접두사 추가", () => {
    expect(escapeCsvField("@SUM(A1:A10)")).not.toMatch(/^@/);
  });

  it("탭 문자로 시작하는 값에 접두사 추가", () => {
    expect(escapeCsvField("\tcmd")).toContain("'");
  });

  it("\\r 로 시작하는 값에 접두사 추가", () => {
    expect(escapeCsvField("\rcmd")).toContain("'");
  });

  // 정상 값은 그대로 통과
  it("한글 이름은 그대로 반환", () => {
    expect(escapeCsvField("김철수")).toBe("김철수");
  });

  it("영문 이름은 그대로 반환", () => {
    expect(escapeCsvField("John")).toBe("John");
  });

  it("빈 문자열은 그대로 반환", () => {
    expect(escapeCsvField("")).toBe("");
  });

  it("숫자만 있는 값은 그대로 반환", () => {
    expect(escapeCsvField("12345")).toBe("12345");
  });

  // 기존 CSV 이스케이프 동작 유지
  it("쉼표가 포함된 값은 따옴표로 감싸기", () => {
    expect(escapeCsvField("서울시 강남구, 역삼동")).toBe('"서울시 강남구, 역삼동"');
  });

  it("따옴표가 포함된 값은 이중 따옴표 처리", () => {
    expect(escapeCsvField('그는 "좋은" 사람')).toBe('"그는 ""좋은"" 사람"');
  });

  it("줄바꿈이 포함된 값은 따옴표로 감싸기", () => {
    expect(escapeCsvField("첫줄\n둘째줄")).toBe('"첫줄\n둘째줄"');
  });

  // 수식 + 특수문자 복합 케이스
  it("수식 문자 + 쉼표 복합 케이스", () => {
    const result = escapeCsvField("=1+1,test");
    expect(result).not.toMatch(/^"=/);
    expect(result).toContain("'");
  });
});
