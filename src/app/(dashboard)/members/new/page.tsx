import MemberForm from "../MemberForm";

export default function NewMemberPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">멤버 등록</h2>
      <p className="mt-2 text-sm text-gray-500">새 멤버 정보를 입력하세요.</p>
      <div className="mt-6">
        <MemberForm />
      </div>
    </div>
  );
}
