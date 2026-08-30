// ═══════════════════════════════════════════════════════════
// KLARO Stripe Webhook — Supabase Edge Function
// Reagiert auf Stripe-Events: generiert License Key bei Zahlung,
// aktualisiert Subscription-Status, sperrt Key bei Kündigung.
// ═══════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2023-10-16" });
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! // Service-Role für DB-Schreibzugriff
);

// License Key im Format KLARO-XXXX-XXXX-XXXX mit Prüfziffer
function generiereLizenzKey(): string {
  const zeichen = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ohne verwechselbare
  const block = () => Array.from({ length: 4 }, () => zeichen[Math.floor(Math.random() * zeichen.length)]).join("");
  const b1 = block(), b2 = block();
  // Prüfziffer aus b1
  let summe = 0;
  for (const c of b1) summe += c.charCodeAt(0);
  const pruef = zeichen[summe % zeichen.length];
  const b3 = block().slice(0, 3) + pruef;
  return `KLARO-${b1}-${b2}-${b3}`;
}

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret);
  } catch (err) {
    return new Response(`Webhook-Signatur ungültig: ${err}`, { status: 400 });
  }

  try {
    switch (event.type) {
      // Zahlung/Trial-Start abgeschlossen → Key generieren + Account verknüpfen
      case "checkout.session.completed": {
        const session = event.data.object;
        const email = session.customer_details?.email || session.customer_email;
        const customerId = session.customer;
        const subscriptionId = session.subscription;
        const key = generiereLizenzKey();

        // Plan aus den Line Items ableiten (via Metadata gesetzt)
        const plan = session.metadata?.plan || "monthly";
        const istTrial = session.metadata?.trial === "true";

        // Profil per E-Mail finden und aktualisieren
        const { data: profil } = await supabase
          .from("profile")
          .select("id")
          .eq("email", email)
          .single();

        if (profil) {
          await supabase
            .from("profile")
            .update({
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              license_key: key,
              plan,
              status: istTrial ? "trial" : "active",
              updated_at: new Date().toISOString(),
            })
            .eq("id", profil.id);
        }
        break;
      }

      // Trial in bezahltes Abo umgewandelt (erste echte Zahlung)
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        await supabase
          .from("profile")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("stripe_customer_id", customerId);
        break;
      }

      // Kündigung → Key deaktivieren
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await supabase
          .from("profile")
          .update({ status: "canceled", updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", sub.id);
        break;
      }

      // Zahlung fehlgeschlagen → Status markieren
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        await supabase
          .from("profile")
          .update({ status: "expired", updated_at: new Date().toISOString() })
          .eq("stripe_customer_id", invoice.customer);
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(`Webhook-Verarbeitung fehlgeschlagen: ${e}`, { status: 500 });
  }
});
