"use client";

export default function LogoutBtn() {
  async function handleLogout() {
    try {
      const res = await fetch("/api/logout", {
        method: "POST",
        credentials: "include", // 🔥 ESSENCIAL
      });

      const data = await res.json();

      if (data.success) {
        window.location.href = "/login";
      } else {
        console.error("Erro no logout", data.error);
      }
    } catch (err) {
      console.error("Logout falhou:", err);
    }
  }

  return (
    <button
      onClick={handleLogout}
      className="px-4 py-2 bg-red-500 text-white rounded-lg"
    >
      Logout
    </button>
  );
}