import PageContainer from "@/components/PageContainer";

export const metadata = {
  title: "Privacy Policy — Giveaway Hub",
};

export default function PrivacyPage() {
  return (
    <PageContainer className="max-w-3xl">
      <h1 className="text-3xl font-bold uppercase font-heading mb-2">Privacy Policy</h1>
      <p className="text-[12px] text-text-secondary mb-10">Last updated: September 2026</p>

      <div className="space-y-8 text-[14px] text-text-secondary leading-relaxed">
        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-text-primary mb-2">
            1. Information We Collect
          </h2>
          <p>
            When you sign in with Discord, we receive your Discord user ID,
            username, and avatar. We do not receive your email address,
            password, or any other Discord account details. We also store
            your points balance, completed offers, and reward redemption
            history.
          </p>
        </section>

        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-text-primary mb-2">
            2. How We Use It
          </h2>
          <p>
            Your Discord ID is used solely to identify your account so your
            points and progress are saved correctly, and so completed offers
            from our partners can be credited to the right person. Your
            username and avatar are used only to display your account in the
            site&apos;s interface.
          </p>
        </section>

        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-text-primary mb-2">
            3. Third-Party Offer Partners
          </h2>
          <p>
            When you choose to complete an offer, our partner network for
            that offer (and, in turn, the advertiser behind it) may collect
            information directly from you as part of completing that offer.
            That collection is governed by the partner&apos;s and
            advertiser&apos;s own privacy policies, not this one. We only
            pass along a tracking identifier so completed offers can be
            matched back to your account for crediting points.
          </p>
        </section>

        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-text-primary mb-2">
            4. Data Storage
          </h2>
          <p>
            Account data is stored securely and is only accessible by the
            site&apos;s systems. We do not sell your information to third
            parties.
          </p>
        </section>

        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-text-primary mb-2">
            5. Cookies
          </h2>
          <p>
            We use a single signed, httpOnly session cookie to keep you
            signed in. It cannot be read or modified by client-side
            JavaScript, and is not used for advertising or tracking outside
            of this site.
          </p>
        </section>

        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-text-primary mb-2">
            6. Your Choices
          </h2>
          <p>
            You can sign out at any time, which removes your session cookie
            from your browser. To request removal of your account data
            entirely, contact us through the Support page.
          </p>
        </section>

        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-text-primary mb-2">
            7. Changes
          </h2>
          <p>
            We may update this policy from time to time. Continuing to use
            the site after a change means you accept the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-text-primary mb-2">
            8. Contact
          </h2>
          <p>
            Questions about this policy can be sent through the Support
            page.
          </p>
        </section>
      </div>
    </PageContainer>
  );
}
