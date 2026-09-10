import PageContainer from "@/components/PageContainer";

export const metadata = {
  title: "Terms of Service — GIVEAWAY HUB",
};

export default function TermsPage() {
  return (
    <PageContainer className="max-w-3xl">
      <h1 className="text-3xl font-bold uppercase font-heading mb-2">Terms of Service</h1>
      <p className="text-[12px] text-text-secondary mb-10">Last updated: September 2026</p>

      <div className="space-y-8 text-[14px] text-text-secondary leading-relaxed">
        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-text-primary mb-2">
            1. What This Site Does
          </h2>
          <p>
            GIVEAWAY HUB lets signed-in users complete tasks and offers from our
            third-party partners (such as surveys, app installs, and other
            promotions) in exchange for points. Points can be redeemed for
            rewards shown on the site.
          </p>
        </section>

        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-text-primary mb-2">
            2. Account &amp; Eligibility
          </h2>
          <p>
            You must sign in with Discord to earn or redeem points. You are
            responsible for the security of your Discord account. Points and
            progress are tied to your Discord account, not to any individual
            browser or device.
          </p>
        </section>

        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-text-primary mb-2">
            3. Points &amp; Offers
          </h2>
          <p>
            Points are only credited once our offer partners confirm that a
            task or offer has been genuinely and legitimately completed.
            Partners may reverse a credit later (a &quot;chargeback&quot;) if a
            completion is found to be fraudulent, incomplete, or invalid — in
            that case, the corresponding points may be deducted from your
            balance. We have no control over how long a partner takes to
            confirm or reverse a completion.
          </p>
        </section>

        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-text-primary mb-2">
            4. Fraud &amp; Abuse
          </h2>
          <p>
            Using bots, VPNs/proxies to fake your location, multiple accounts,
            or any other method to falsely trigger point credits is not
            allowed and may result in loss of points, forfeiture of rewards,
            or account suspension.
          </p>
        </section>

        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-text-primary mb-2">
            5. Rewards
          </h2>
          <p>
            Rewards are redeemed at the point cost shown at the time of
            redemption. Redeemed rewards are delivered on a best-effort basis
            and are non-refundable once fulfilled.
          </p>
        </section>

        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-text-primary mb-2">
            6. Third-Party Partners
          </h2>
          <p>
            Offers are provided by independent third-party networks. We are
            not responsible for the content, availability, or accuracy of
            third-party offers, and completing an offer may involve sharing
            information directly with that third party under its own terms.
          </p>
        </section>

        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-text-primary mb-2">
            7. Changes
          </h2>
          <p>
            We may update these terms from time to time. Continuing to use
            the site after a change means you accept the updated terms.
          </p>
        </section>

        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-text-primary mb-2">
            8. Contact
          </h2>
          <p>
            Questions about these terms can be sent through the Support page.
          </p>
        </section>
      </div>
    </PageContainer>
  );
}
