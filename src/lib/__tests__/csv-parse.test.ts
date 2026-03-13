import { parseCsvLine } from "@/lib/csv";

describe("parseCsvLine - CSV 라인 파서", () => {
  it("쉼표로 구분된 단순 값 파싱", () => {
    expect(parseCsvLine("김,철수,active")).toEqual(["김", "철수", "active"]);
  });

  it("따옴표로 감싼 필드(쉼표 포함) 파싱", () => {
    expect(parseCsvLine('"서울시, 강남구",김철수')).toEqual([
      "서울시, 강남구",
      "김철수",
    ]);
  });

  it("이중 따옴표 이스케이프 처리", () => {
    expect(parseCsvLine('"그는 ""좋은"" 사람",값2')).toEqual([
      '그는 "좋은" 사람',
      "값2",
    ]);
  });

  it("필드 앞뒤 공백 제거", () => {
    expect(parseCsvLine(" 김 , 철수 , active ")).toEqual([
      "김",
      "철수",
      "active",
    ]);
  });

  it("빈 문자열 처리", () => {
    expect(parseCsvLine("")).toEqual([""]);
  });

  it("단일 필드 처리", () => {
    expect(parseCsvLine("김철수")).toEqual(["김철수"]);
  });

  it("한국어 문자 처리", () => {
    expect(parseCsvLine("박,지영,새가족,이음교회")).toEqual([
      "박",
      "지영",
      "새가족",
      "이음교회",
    ]);
  });

  it("빈 필드가 포함된 라인 처리", () => {
    expect(parseCsvLine("김,,active,")).toEqual(["김", "", "active", ""]);
  });
});
