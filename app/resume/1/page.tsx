import BasicInfoForm from "./BasicInfoForm";

export default function ResumeStep1Page() {
  return (
    <div
      style={{
        maxWidth: "720px",
        margin: "0 auto",
        padding: "32px 24px",
        backgroundColor: "var(--color-bg, #FFFFFF)",
      }}
    >
      <BasicInfoForm />
    </div>
  );
}
