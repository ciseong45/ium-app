/**
 * CSV 필드 이스케이프 + 수식 인젝션 방어
 * - =, +, -, @, \t, \r 로 시작하는 값에 ' 접두사 추가 (Excel 수식 실행 방지)
 * - 쉼표, 따옴표, 줄바꿈이 포함된 값은 따옴표로 감싸기
 */
export function escapeCsvField(value: string): string {
  let sanitized = value;
  if (/^[=+\-@\t\r]/.test(sanitized)) {
    sanitized = "'" + sanitized;
  }
  if (sanitized.includes(",") || sanitized.includes('"') || sanitized.includes("\n")) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

/**
 * CSV 라인 파서 (따옴표 이스케이프 지원)
 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}
