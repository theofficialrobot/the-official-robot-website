export default function ReqLabel({ children, required = true }) {
  return (
    <>
      {children}
      {required ? <span className="text-red-600 ml-0.5" aria-hidden="true">*</span> : null}
    </>
  );
}
