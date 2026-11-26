import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { SUBSCRIPTION_PLANS } from "@/lib/plans";

export async function POST(request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ message: "Please sign in first." }, { status: 401 });
    }

    const body = await request.json();
    if (
      typeof body.plan !== "string" ||
      !Object.hasOwn(SUBSCRIPTION_PLANS, body.plan)
    ) {
      return NextResponse.json({ message: "Choose a valid subscription plan." }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { clerkId: userId },
      data: { subscriptionPlan: body.plan },
      select: { subscriptionPlan: true },
    });

    return NextResponse.json({
      message: `${SUBSCRIPTION_PLANS[user.subscriptionPlan].name} plan selected. Payment will be added later.`,
      plan: user.subscriptionPlan,
    });
  } catch (error) {
    if (error.code === "P2025") {
      return NextResponse.json(
        { message: "Please complete your profile before choosing a plan." },
        { status: 404 }
      );
    }

    console.error("Update subscription plan error:", error);
    return NextResponse.json(
      { message: "Could not update your subscription plan." },
      { status: 500 }
    );
  }
}
