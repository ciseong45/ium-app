/**
 * 데이터가 없을 때 표시하는 공통 빈 상태 컴포넌트
 */
export default function EmptyState({ message }: { message: string }) {
  return (
    <p className="mt-8 text-center text-gray-400">
      {message}
    </p>
  );
}
