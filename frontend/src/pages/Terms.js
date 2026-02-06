import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const Terms = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    // Check if we have a referrer from the same site, otherwise go to signup
    const referrer = document.referrer;
    const currentHost = window.location.host;
    
    if (referrer && referrer.includes(currentHost)) {
      // We came from another page on this site, go back
      navigate(-1);
    } else {
      // Opened directly or from external link, go to signup
      navigate('/signup');
    }
  };

  const Section = ({ title, children }) => (
    <div className="mb-6">
      <h2 className="text-brand-400 text-lg font-semibold mb-3">{title}</h2>
      <div className="text-gray-300 text-sm leading-relaxed space-y-2">
        {children}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-appbg px-4 py-6">
      {/* Back Button */}
      <button
        onClick={handleBack}
        className="w-10 h-10 rounded-full bg-cardBg flex items-center justify-center text-white hover:bg-zinc-800 transition-colors mb-6"
        data-testid="back-button"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Logo */}
      <div className="text-center mb-8">
        <img 
          src="https://customer-assets.emergentagent.com/job_appointly-24/artifacts/syzj4nzu_1770417348108.png" 
          alt="Calendrax" 
          className="h-16 mx-auto"
        />
      </div>

      <div className="max-w-3xl mx-auto" data-testid="terms-page">
        <h1 className="text-white text-3xl font-bold mb-6">Terms and Conditions</h1>
        
        <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
          
          <Section title="1. Introduction">
            <p>Welcome to Calendrax. These Terms and Conditions govern your use of the Calendrax platform and services operated by Gareth Grey (Sole Trader) trading as Calendrax ("we", "us", "our").</p>
            <p>By accessing or using Calendrax, you agree to be bound by these Terms. If you do not agree to these Terms, please do not use our services.</p>
          </Section>

          <Section title="2. Definitions">
            <p><strong className="text-white">Platform:</strong> The Calendrax website and application.</p>
            <p><strong className="text-white">Business Owner:</strong> A user who registers to offer services and accept bookings through Calendrax.</p>
            <p><strong className="text-white">Customer:</strong> A user who books appointments with Business Owners through the Platform.</p>
            <p><strong className="text-white">Services:</strong> The booking management, scheduling, and payment processing features provided by Calendrax.</p>
          </Section>

          <Section title="3. Account Registration">
            <p>To use certain features of Calendrax, you must create an account. You agree to:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Provide accurate, current, and complete information during registration</li>
              <li>Maintain and update your information to keep it accurate and current</li>
              <li>Keep your password secure and confidential</li>
              <li>Accept responsibility for all activities under your account</li>
              <li>Notify us immediately of any unauthorised use of your account</li>
            </ul>
          </Section>

          <Section title="4. Business Owner Subscriptions">
            <p>Business Owners may subscribe to Calendrax to access premium features. Our subscription pricing is as follows:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li><strong className="text-white">Base subscription:</strong> £10 per month for one staff member</li>
              <li><strong className="text-white">Additional staff:</strong> £5 per month for each additional staff member</li>
              <li><strong className="text-white">Free trial:</strong> 30-day free trial for new Business Owners</li>
            </ul>
            <p className="mt-2">Prices are exclusive of VAT. We are not currently VAT registered.</p>
            <p>Subscriptions are billed monthly and will automatically renew unless cancelled. You may cancel your subscription at any time through your account dashboard.</p>
          </Section>

          <Section title="5. Customer Deposits and Platform Fees">
            <p>Business Owners may require customers to pay a deposit when booking appointments. The following terms apply:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Calendrax charges a <strong className="text-white">5% application fee</strong> on all customer deposits to cover payment processing costs</li>
              <li>The remaining 95% of the deposit is transferred to the Business Owner's connected Stripe account</li>
              <li>Deposit amounts and refund policies are set by individual Business Owners</li>
            </ul>
          </Section>

          <Section title="6. Cancellations and Refunds">
            <p><strong className="text-white">For Customers:</strong></p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Cancellation policies are set by individual Business Owners</li>
              <li>Please review the Business Owner's cancellation policy before booking</li>
              <li>Refunds for deposits are at the discretion of the Business Owner</li>
            </ul>
            <p className="mt-2"><strong className="text-white">For Business Owners:</strong></p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Subscription fees are non-refundable for the current billing period</li>
              <li>You may cancel your subscription at any time to prevent future charges</li>
              <li>No refunds are provided for partial months of service</li>
            </ul>
          </Section>

          <Section title="7. Acceptable Use">
            <p>You agree not to:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Use the Platform for any unlawful purpose</li>
              <li>Impersonate any person or entity</li>
              <li>Interfere with or disrupt the Platform or servers</li>
              <li>Attempt to gain unauthorised access to any part of the Platform</li>
              <li>Upload viruses or malicious code</li>
              <li>Harass, abuse, or harm other users</li>
              <li>Use the Platform to send spam or unsolicited communications</li>
            </ul>
          </Section>

          <Section title="8. Intellectual Property">
            <p>The Calendrax name, logo, and all related content, features, and functionality are owned by Gareth Grey trading as Calendrax and are protected by copyright, trademark, and other intellectual property laws.</p>
            <p>You may not reproduce, distribute, modify, or create derivative works from any content on the Platform without our prior written consent.</p>
          </Section>

          <Section title="9. Limitation of Liability">
            <p>To the fullest extent permitted by law:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Calendrax is provided "as is" without warranties of any kind</li>
              <li>We are not liable for any indirect, incidental, or consequential damages</li>
              <li>Our total liability shall not exceed the amount paid by you in the 12 months preceding any claim</li>
              <li>We are not responsible for disputes between Business Owners and Customers</li>
            </ul>
          </Section>

          <Section title="10. Indemnification">
            <p>You agree to indemnify and hold harmless Gareth Grey trading as Calendrax from any claims, damages, losses, or expenses arising from your use of the Platform or violation of these Terms.</p>
          </Section>

          <Section title="11. Termination">
            <p>We may suspend or terminate your account at any time for violation of these Terms or for any other reason at our sole discretion. Upon termination:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Your right to use the Platform will immediately cease</li>
              <li>We may delete your account and data in accordance with our Privacy Policy</li>
              <li>Any outstanding payments remain due</li>
            </ul>
          </Section>

          <Section title="12. Changes to Terms">
            <p>We may update these Terms from time to time. We will notify you of significant changes by posting the new Terms on the Platform and updating the "Last updated" date. Your continued use of the Platform after changes constitutes acceptance of the updated Terms.</p>
          </Section>

          <Section title="13. Governing Law">
            <p>These Terms are governed by and construed in accordance with the laws of England and Wales. Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts of England and Wales.</p>
          </Section>

          <Section title="14. Contact Us">
            <p>If you have any questions about these Terms, please contact us at:</p>
            <p className="mt-2">
              <strong className="text-white">Gareth Grey trading as Calendrax</strong><br />
              Email: support@calendrax.com
            </p>
          </Section>

        </div>

        <p className="text-gray-500 text-sm mt-6 text-center">
          Last updated: December 2025
        </p>
      </div>
    </div>
  );
};

export default Terms;
