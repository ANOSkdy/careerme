import ExperienceForm from "./ExperienceForm";

export default function ResumeExperiencePage() {
  return (
    <div
      style={{
        maxWidth: "720px",
        margin: "0 auto",
        padding: "32px 24px",
        backgroundColor: "var(--color-bg, #ffffff)",
      }}
    >
      <ExperienceForm />
    </div>
  );
}
