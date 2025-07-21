'use client';

export default function LoginButton() {
  return (
    <button
      className="flex items-center gap-2 bg-slate-600 hover:bg-slate-700 transition-colors px-4 py-2 rounded text-white font-medium"
      onClick={() => (window.location.href = 'http://localhost:8080/login')}
      type="button"
    >
      <img
        src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png"
        alt="GitHub logo"
        className="h-5 w-5"
      />
      Sign In With GitHub
    </button>
  );
}
