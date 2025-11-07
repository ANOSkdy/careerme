import StatusForm from "./StatusForm";

export default function ResumeStatusPage() {
  return (
    <div
      style={{
        maxWidth: "720px",
        margin: "0 auto",
        padding: "32px 24px",
        backgroundColor: "var(--color-bg, #FFFFFF)",
      }}
    >
      <StatusForm />
    </div>
  );
}
