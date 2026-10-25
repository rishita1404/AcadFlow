export default function AuthFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="auth-page-footer" role="contentinfo">
      <div>AcadFlow · Unified Academic Platform</div>
      <div>&copy; {currentYear} AcadFlow</div>
    </footer>
  );
}
