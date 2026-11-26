"use client";

import Image from "next/image";
import { useState } from "react";
import img1 from "@/Images/img1.jpeg";
import { SUBSCRIPTION_PLANS } from "@/lib/plans";

const PLAN_STYLES = {
  FREE: {
    card: "border-white/20 bg-white/[0.06] hover:bg-white/[0.12] hover:border-white/40",
    button: "border border-white/30 bg-white/10 hover:bg-white/20",
    title: "text-white",
  },
  SILVER: {
    card: "border-blue-400/60 bg-blue-500/[0.12] hover:bg-blue-500/20 hover:border-blue-300",
    button: "bg-blue-500 hover:bg-blue-400",
    title: "text-blue-200",
  },
  GOLD: {
    card: "border-yellow-400/60 bg-yellow-500/[0.10] hover:bg-yellow-500/20 hover:border-yellow-300",
    button: "bg-yellow-500 text-gray-950 hover:bg-yellow-400",
    title: "text-yellow-300",
  },
};

export default function Hero() {
  const [currentPlan, setCurrentPlan] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);

  async function choosePlan(plan) {
    setLoadingPlan(plan);
    setMessage("");
    setMessageIsError(false);

    try {
      const response = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Could not select this plan.");
      }

      setCurrentPlan(data.plan);
      setMessage(data.message);
    } catch (error) {
      setMessage(error.message);
      setMessageIsError(true);
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <main className="relative -mt-16 flex min-h-screen w-full items-center justify-center overflow-hidden bg-gray-950 p-4 sm:p-6 lg:p-8">
      <Image
        src={img1}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-black/40" />

      <section className="relative z-10 w-full max-w-5xl rounded-2xl border border-white/20 bg-white/8 p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] backdrop-blur-xl backdrop-saturate-150 sm:rounded-3xl sm:p-8 md:p-10">
        <div className="mx-auto mb-8 max-w-2xl text-center sm:mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Choose your plan
          </h1>
          <p className="mt-2 text-sm text-gray-200 sm:text-base">
            Pick a plan for your watch rooms. Payment gateway will be added later.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-5 lg:gap-6">
          {Object.entries(SUBSCRIPTION_PLANS).map(([plan, details]) => {
            const styles = PLAN_STYLES[plan];
            const selected = currentPlan === plan;

            return (
              <article
                key={plan}
                className={`group rounded-xl border p-5 text-center transition-all duration-300 hover:-translate-y-1 sm:rounded-2xl ${styles.card} ${
                  plan === "GOLD" ? "sm:col-span-2 lg:col-span-1" : ""
                }`}
              >
                <h2 className={`text-xl font-semibold ${styles.title}`}>
                  {details.name}
                </h2>
                <p className="mt-4 text-3xl font-bold text-white">
                  {details.durationHours}{" "}
                  {details.durationHours === 1 ? "hour" : "hours"}
                </p>
                <ul className="mt-4 space-y-2 text-sm text-gray-200">
                  <li>{details.maxMembers} members per room (including host)</li>
                  <li>Up to {details.uploadLabel} per video</li>
                  <li>
                    Room ends {details.durationHours}{" "}
                    {details.durationHours === 1 ? "hour" : "hours"} after creation
                  </li>
                </ul>
                <button
                  type="button"
                  onClick={() => choosePlan(plan)}
                  disabled={loadingPlan !== null}
                  className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${styles.button}`}
                >
                  {loadingPlan === plan
                    ? "Saving..."
                    : selected
                      ? "Current plan"
                      : `Choose ${details.name}`}
                </button>
              </article>
            );
          })}
        </div>

        {message && (
          <p
            role={messageIsError ? "alert" : "status"}
            className={`mt-6 text-center text-sm ${
              messageIsError ? "text-red-300" : "text-emerald-300"
            }`}
          >
            {message}
          </p>
        )}
      </section>
    </main>
  );
}
