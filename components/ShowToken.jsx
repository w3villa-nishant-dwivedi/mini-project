"use client";

import { useAuth } from "@clerk/nextjs";

export function ShowToken() {
  const { getToken } = useAuth();

  const showToken = async () => {
    const token = await getToken();
    console.log("Token:", token);
  };

  return (
    <button
      onClick={showToken}
      className="mt-6 rounded-lg border border-gray-700 px-5 py-3 font-medium hover:bg-gray-800"
    >
      Show Token
    </button>
  );
}