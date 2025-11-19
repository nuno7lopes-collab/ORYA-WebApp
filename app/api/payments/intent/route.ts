import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { slug, amount, userId, ticketId, quantity, eventId, price } = await req.json();

    if (!slug || !amount) {
      return NextResponse.json(
        { error: "Dados incompletos." },
        { status: 400 }
      );
    }

    if (!userId || !ticketId || !quantity || !eventId || !price) {
      return NextResponse.json(
        { error: "Metadata incompleta para o pagamento." },
        { status: 400 }
      );
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // €
      currency: "eur",
      automatic_payment_methods: { enabled: true },
      metadata: {
        slug,
        userId,
        ticketId,
        quantity: String(quantity),
        eventId: String(eventId),
        price: String(price)
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err: any) {
    console.error("❌ Erro no Payment Intent:", err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}